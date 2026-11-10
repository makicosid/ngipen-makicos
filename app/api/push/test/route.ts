import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

export const runtime = "nodejs";

const USER_COOKIE_NAME = "ngipen_session";

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase server belum lengkap.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getFirebaseAdmin() {
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

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const supabase = getSupabaseAdmin();
    const sessionToken = request.cookies.get(USER_COOKIE_NAME)?.value;
    if (!sessionToken) return json({ error: "Silakan login terlebih dahulu." }, 401);

    const { data: session, error: sessionError } = await supabase
      .from("ngipen_sessions")
      .select("user_id")
      .eq("token_hash", hashToken(sessionToken))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError) throw new Error("Gagal memeriksa sesi pengguna.");
    if (!session?.user_id) return json({ error: "Sesi pengguna tidak valid." }, 401);

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id,fcm_token")
      .eq("user_id", session.user_id)
      .eq("is_active", true);

    if (error) throw new Error("Gagal mengambil perangkat notifikasi.");
    if (!subscriptions?.length) return json({ error: "Belum ada perangkat yang terdaftar." }, 404);

    const messaging = getFirebaseAdmin();
    const results = await Promise.all(subscriptions.map(async (subscription) => {
      try {
        const messageId = await messaging.send({
          token: subscription.fcm_token,
          data: {
            title: "🎉 NGIPEN — Notifikasi Aktif!",
            body: "Perangkat ini berhasil terhubung dengan notifikasi NGIPEN.",
            url: "/",
          },
          webpush: { fcmOptions: { link: "/" } },
        });
        return { id: subscription.id, success: true, messageId };
      } catch (sendError) {
        const code = typeof sendError === "object" && sendError && "code" in sendError
          ? String(sendError.code) : "unknown";
        if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
          await supabase.from("push_subscriptions").update({
            is_active: false,
            invalidated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", subscription.id);
        }
        console.error("FCM test delivery failed:", code);
        return { id: subscription.id, success: false };
      }
    }));

    return json({
      success: results.some((result) => result.success),
      sent: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
    });
  } catch (error) {
    console.error("FCM test endpoint failed:", error);
    return json({ error: "Pengiriman notifikasi percobaan gagal." }, 500);
  }
}
