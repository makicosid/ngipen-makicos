import { NextRequest } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { adminJson, isSameOrigin, requireAdmin } from "../../../../../../lib/server/admin-push";

export const runtime = "nodejs";
export const maxDuration = 60;

// Keep production delivery locked in code until the owner separately approves it.
const LIVE_SEND_APPROVED = false;

function getFirebaseMessaging() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Kredensial Firebase Admin belum dikonfigurasi.");
  }
  const app = getApps().find((item) => item.name === "ngipen-fcm") ||
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId }, "ngipen-fcm");
  return getMessaging(app);
}

type DeliveryUpdate = {
  id: string;
  delivery_status: "sent" | "failed";
  provider_message_id?: string;
  error_code?: string;
  error_message?: string;
  attempted_at: string;
};

export async function POST(
  request: NextRequest,
  context: { params: { campaignId: string } }
) {
  try {
    if (!isSameOrigin(request)) return adminJson({ error: "Permintaan tidak diizinkan." }, 403);
    const supabase = await requireAdmin(request);
    if (!supabase) return adminJson({ error: "Sesi admin tidak valid." }, 401);

    // Deliberately disabled until the owner separately approves live production sends.
    if (!LIVE_SEND_APPROVED || process.env.PUSH_CAMPAIGNS_SEND_ENABLED !== "true") {
      return adminJson({ error: "Pengiriman produksi belum diaktifkan. Persetujuan terpisah diperlukan." }, 423);
    }

    const campaignId = context.params.campaignId;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(campaignId)) return adminJson({ error: "ID kampanye tidak valid." }, 400);

    // Atomic claim: a campaign can only transition from draft once.
    const startedAt = new Date().toISOString();
    const { data: campaign, error: claimError } = await supabase
      .from("push_campaigns")
      .update({ status: "sending", send_started_at: startedAt })
      .eq("id", campaignId)
      .eq("status", "draft")
      .select("id,title,body,target_url")
      .maybeSingle();

    if (claimError) throw new Error("Gagal mengunci kampanye untuk pengiriman.");
    if (!campaign) return adminJson({ error: "Kampanye tidak ditemukan atau sudah pernah diproses." }, 409);

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("id,fcm_token")
      .eq("is_active", true);

    if (subscriptionsError) {
      await supabase.from("push_campaigns").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", campaignId);
      throw new Error("Gagal mengambil daftar perangkat aktif.");
    }

    const targets = subscriptions ?? [];
    await supabase.from("push_campaigns").update({ total_targets: targets.length }).eq("id", campaignId);

    if (targets.length === 0) {
      await supabase.from("push_campaigns").update({
        status: "completed",
        total_targets: 0,
        total_sent: 0,
        total_failed: 0,
        completed_at: new Date().toISOString(),
      }).eq("id", campaignId);
      return adminJson({ success: true, sent: 0, failed: 0 });
    }

    const { data: deliveryRows, error: deliveryInsertError } = await supabase
      .from("push_campaign_deliveries")
      .insert(targets.map((item) => ({
        campaign_id: campaignId,
        subscription_id: item.id,
        delivery_status: "pending",
      })))
      .select("id,subscription_id");

    if (deliveryInsertError || !deliveryRows) {
      await supabase.from("push_campaigns").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", campaignId);
      throw new Error("Gagal menyiapkan catatan pengiriman perangkat.");
    }

    const deliveryBySubscription = new Map(deliveryRows.map((row) => [row.subscription_id, row.id]));
    const messaging = getFirebaseMessaging();
    let sent = 0;
    let failed = 0;
    const invalidTokenIds: string[] = [];

    for (let offset = 0; offset < targets.length; offset += 500) {
      const batch = targets.slice(offset, offset + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: batch.map((item) => item.fcm_token),
        data: {
          title: campaign.title,
          body: campaign.body,
          url: campaign.target_url,
        },
      });

      const attemptedAt = new Date().toISOString();
      const updates: DeliveryUpdate[] = response.responses.map((item, index) => {
        const target = batch[index];
        if (item.success) {
          sent += 1;
          return {
            id: deliveryBySubscription.get(target.id)!,
            delivery_status: "sent",
            provider_message_id: item.messageId,
            attempted_at: attemptedAt,
          };
        }

        failed += 1;
        const code = item.error?.code || "unknown";
        if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
          invalidTokenIds.push(target.id);
        }
        return {
          id: deliveryBySubscription.get(target.id)!,
          delivery_status: "failed",
          error_code: code.slice(0, 120),
          error_message: (item.error?.message || "FCM delivery failed").slice(0, 500),
          attempted_at: attemptedAt,
        };
      });

      for (const update of updates) {
        const { id, ...values } = update;
        await supabase.from("push_campaign_deliveries").update(values).eq("id", id);
      }
    }

    if (invalidTokenIds.length) {
      await supabase.from("push_subscriptions")
        .update({
          is_active: false,
          invalidated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", invalidTokenIds);
    }

    const completedAt = new Date().toISOString();
    const { error: finishError } = await supabase.from("push_campaigns").update({
      status: failed > 0 ? (sent > 0 ? "completed_with_errors" : "failed") : "completed",
      total_targets: targets.length,
      total_sent: sent,
      total_failed: failed,
      completed_at: completedAt,
    }).eq("id", campaignId);

    if (finishError) throw new Error("Pengiriman selesai, tetapi rekap kampanye gagal diperbarui.");
    return adminJson({ success: true, sent, failed, total: targets.length });
  } catch (error) {
    console.error("Admin push send failed:", error);
    return adminJson({ error: "Pengiriman kampanye gagal diproses." }, 500);
  }
}
