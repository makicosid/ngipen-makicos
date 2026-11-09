
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

let supabaseAdmin: ReturnType<typeof createClient<any>> | undefined;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server configuration is unavailable.");
  }

  supabaseAdmin = createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return supabaseAdmin;
}

const COOKIE_NAME = "ngipen_session";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getSession(
  request: NextRequest
): Promise<{ user_id: string; expires_at: string } | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("ngipen_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  return data as { user_id: string; expires_at: string };
}

async function getVisibleEventIds(eventIds: string[]) {
  const visible = new Set<string>();
  if (eventIds.length === 0) return visible;

  for (let offset = 0; offset < eventIds.length; offset += 200) {
    const batch = eventIds.slice(offset, offset + 200);
    const { data, error } = await getSupabaseAdmin()
      .from("events")
      .select("id")
      .in("id", batch)
      .eq("moderation_status", "Approved")
      .eq("is_hidden", false);

    if (error) throw error;
    ((data as Array<{ id: string }> | null) || []).forEach((event) =>
      visible.add(String(event.id))
    );
  }

  return visible;
}

/* =====================================================
   GET - PUBLIC REVIEWS + PERSONAL RATINGS
===================================================== */

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);
    const adminToken = request.cookies.get("ngipen_admin_session")?.value;
    let isAdmin = false;

    if (adminToken) {
      const { data: adminSession, error: adminSessionError } = await getSupabaseAdmin()
        .from("admin_sessions")
        .select("token_hash")
        .eq("token_hash", hashToken(adminToken))
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      isAdmin = !adminSessionError && Boolean(adminSession);
    }

    if (!session && !isAdmin) {
      return json({ error: "Silakan login untuk melihat komentar event." }, 401);
    }

    const eventId = request.nextUrl.searchParams.get("eventId");

    let query = getSupabaseAdmin()
      .from("event_reviews")
      .select("id, event_id, user_id, rating, comment, created_at")
      .order("created_at", { ascending: false });

    if (eventId) {
      query = query.eq("event_id", eventId);
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.error("Get event reviews error:", error);
      return json({ error: "Gagal mengambil ulasan event." }, 500);
    }

    const myRatings: Record<string, number> = {};
    let personalReviews: Array<{ event_id: string; rating: number }> = [];

    if (session) {
      let personalQuery = getSupabaseAdmin()
        .from("event_reviews")
        .select("event_id, rating")
        .eq("user_id", session.user_id);

      if (eventId) {
        personalQuery = personalQuery.eq("event_id", eventId);
      }

      const { data, error: personalError } =
        await personalQuery;

      if (personalError) {
        console.error("Get personal ratings error:", personalError);
        return json({ error: "Gagal mengambil rating pribadi." }, 500);
      }

      personalReviews = (data || []) as Array<{ event_id: string; rating: number }>;
    }

    const candidateEventIds = Array.from(new Set([
      ...(reviews || []).map((review: any) => String(review.event_id)),
      ...personalReviews.map((review) => String(review.event_id)),
    ]));
    const visibleEventIds = await getVisibleEventIds(candidateEventIds);
    const publicReviews = (reviews || []).filter((review: any) =>
      visibleEventIds.has(String(review.event_id))
    );
    personalReviews.forEach((review) => {
      if (visibleEventIds.has(String(review.event_id))) {
        myRatings[String(review.event_id)] = Number(review.rating);
      }
    });

    // Data kartu profil hanya dikirim melalui endpoint terautentikasi.
    // Username login dan kredensial tidak pernah dikirim.
    const reviewerIds = Array.from(new Set(
      publicReviews
        .map((review: any) => String(review.user_id || ""))
        .filter(Boolean)
    ));

    const publicProfileMap = new Map<string, { display_name: string; avatar_url: string }>();
    for (let offset = 0; offset < reviewerIds.length; offset += 200) {
      const { data: profiles, error: profilesError } = await getSupabaseAdmin()
        .from("users")
        .select("id, display_name, avatar_url")
        .in("id", reviewerIds.slice(offset, offset + 200));

      if (profilesError) {
        console.error("Get reviewer public profiles error:", profilesError);
        return json({ error: "Gagal mengambil identitas publik reviewer." }, 500);
      }

      (profiles || []).forEach((profile: any) => {
        publicProfileMap.set(String(profile.id), {
          display_name: String(profile.display_name || "Pengguna"),
          avatar_url: String(profile.avatar_url || ""),
        });
      });
    }

    const reviewsWithProfiles = publicReviews.map((review: any) => {
      const profile = publicProfileMap.get(String(review.user_id || ""));
      return {
        ...review,
        display_name: profile?.display_name || "Pengguna",
        avatar_url: profile?.avatar_url || "",
      };
    });

    return json({
      success: true,
      reviews: reviewsWithProfiles,
      myRatings,
    });
  } catch (error) {
    console.error("Event reviews GET error:", error);
    return json({ error: "Terjadi kesalahan server." }, 500);
  }
}

/* =====================================================
   POST - CREATE OR UPDATE REVIEW
===================================================== */

export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const session = await getSession(request);

    if (!session) {
      return json({ error: "Silakan login terlebih dahulu." }, 401);
    }

    const body = await request.json();

    const eventId =
      typeof body.eventId === "string" ? body.eventId.trim() : "";

    const hasRating = body.rating !== undefined && body.rating !== null;
    const hasComment = body.comment !== undefined;

    if (!eventId || eventId.length > 100) {
      return json({ error: "Event tidak valid." }, 400);
    }

    if (!hasRating && !hasComment) {
      return json({ error: "Rating atau komentar harus diisi." }, 400);
    }

    let rating: number | undefined;

    if (hasRating) {
      rating = Number(body.rating);

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return json({ error: "Rating harus antara 1 sampai 5." }, 400);
      }
    }

    let comment: string | undefined;

    if (hasComment) {
      if (typeof body.comment !== "string") {
        return json({ error: "Format komentar tidak valid." }, 400);
      }

      comment = body.comment.trim();

     if (comment!.length > 1500) {
  return json({ error: "Komentar maksimal 1500 karakter." }, 400);
}
    }

    // Pastikan event memang tersedia.
    const { data: event, error: eventError } = await getSupabaseAdmin()
      .from("events")
      .select("id, moderation_status, is_hidden")
      .eq("id", eventId)
      .maybeSingle();

    if (
      eventError ||
      !event ||
      event.moderation_status !== "Approved" ||
      event.is_hidden !== false
    ) {
      return json({ error: "Event tidak ditemukan." }, 404);
    }

    // Identitas user selalu berasal dari sesi server.
    const { data: existing, error: lookupError } = await getSupabaseAdmin()
      .from("event_reviews")
      .select("id, rating, comment")
      .eq("user_id", session.user_id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (lookupError) {
      console.error("Review lookup error:", lookupError);
      return json({ error: "Gagal memeriksa ulasan sebelumnya." }, 500);
    }

    const payload: Record<string, any> = {};

    if (rating !== undefined) {
      payload.rating = rating;
    } else if (existing) {
      payload.rating = existing.rating;
    } else {
      payload.rating = 5;
    }

    if (comment !== undefined) {
      payload.comment = comment;
    } else if (!existing) {
      payload.comment = "";
    }

    let savedReview: any = null;
    let saveError: any = null;

    if (existing) {
      const result = await getSupabaseAdmin()
        .from("event_reviews")
        .update({
          ...payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("user_id", session.user_id)
        .select("id, event_id, user_id, rating, comment, created_at")
        .single();

      savedReview = result.data;
      saveError = result.error;
    } else {
      const result = await getSupabaseAdmin()
        .from("event_reviews")
        .insert({
          user_id: session.user_id,
          event_id: eventId,
          ...payload,
        })
        .select("id, event_id, user_id, rating, comment, created_at")
        .single();

      savedReview = result.data;
      saveError = result.error;
    }

    if (saveError || !savedReview) {
      console.error("Save review error:", saveError);
      return json({ error: "Gagal menyimpan ulasan." }, 500);
    }

    // Hitung ulang statistik rating di server.
    const { data: allReviews, error: refreshError } = await getSupabaseAdmin()
      .from("event_reviews")
      .select("rating")
      .eq("event_id", eventId);

    if (refreshError) {
      console.error("Review statistics error:", refreshError);
      return json({
        success: true,
        review: savedReview,
        warning: "Ulasan tersimpan, tetapi statistik rating gagal diperbarui.",
      });
    }

    const reviewCount = allReviews?.length || 0;
    const average =
      reviewCount > 0
        ? allReviews!.reduce(
            (sum: number, item: any) => sum + Number(item.rating || 0),
            0
          ) / reviewCount
        : 0;

    const { error: eventUpdateError } = await getSupabaseAdmin()
      .from("events")
      .update({
        avg_rating: average,
        rating_count: reviewCount,
      })
      .eq("id", eventId);

    if (eventUpdateError) {
      console.error("Event rating update error:", eventUpdateError);
    }

    return json({
      success: true,
      review: savedReview,
      avg_rating: average,
      rating_count: reviewCount,
    });
  } catch (error) {
    console.error("Event reviews POST error:", error);
    return json({ error: "Terjadi kesalahan server." }, 500);
  }
}
