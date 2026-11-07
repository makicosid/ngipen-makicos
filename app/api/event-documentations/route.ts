
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";

export const runtime = "nodejs";

const COOKIE_NAME = "ngipen_session";
const BUCKET_NAME = "documentations";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Konfigurasi Supabase server belum lengkap.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}


const ADMIN_COOKIE_NAME = "ngipen_admin_session";

async function hasValidAdminSession(request: NextRequest, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;

  const { data, error } = await supabase
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Documentation admin session check error:", error);
    return false;
  }

  return Boolean(data);
}

async function getSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("ngipen_sessions")
    .select("user_id")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  return data;
}

function isValidImage(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      )
    );
  }

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }

  return false;
}

function getEventTimeStatus(event: {
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
}) {
  const now = new Date();

  const startTime = event.start_time || "00:00:00";
  const endTime = event.end_time || "23:59:59";

  const start = new Date(
    `${event.start_date}T${startTime}+07:00`
  );

  const end = new Date(
    `${event.end_date}T${endTime}+07:00`
  );

  if (
    !event.start_date ||
    !event.end_date ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return "Upcoming";
  }

  if (now < start) return "Upcoming";
  if (now < end) return "Ongoing";

  return "Completed";
}

// GET: Dokumentasi dapat dilihat publik.
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const session = await getSession(request);
    const isAdmin = await hasValidAdminSession(request, supabase);

    const { data, error } = await supabase
      .from("event_documentations")
      .select("id, event_id, user_id, image_url, caption, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch event documentations error:", error);
      return json(
        { error: "Gagal mengambil dokumentasi event." },
        500
      );
    }

    const eventIds = Array.from(new Set((data || []).map((doc) => String(doc.event_id))));
    const visibleCompletedEventIds = new Set<string>();

    for (let offset = 0; offset < eventIds.length; offset += 200) {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, moderation_status, is_hidden, start_date, end_date, start_time, end_time")
        .in("id", eventIds.slice(offset, offset + 200))
        .eq("moderation_status", "Approved")
        .eq("is_hidden", false);

      if (eventsError) {
        console.error("Filter public documentation error:", eventsError);
        return json({ error: "Gagal mengambil dokumentasi event." }, 500);
      }

      (events || []).forEach((event) => {
        if (getEventTimeStatus(event) === "Completed") {
          visibleCompletedEventIds.add(String(event.id));
        }
      });
    }

    const visibleDocs = (data || []).filter((doc) =>
      visibleCompletedEventIds.has(String(doc.event_id))
    );

    // Profil publik dokumentasi hanya memuat display_name dan avatar_url.
    // Kolom username lama tidak pernah dikirim ke browser.
    const uploaderIds = Array.from(new Set(
      visibleDocs.map((doc: any) => String(doc.user_id || "")).filter(Boolean)
    ));
    const uploaderProfiles = new Map<string, { display_name: string; avatar_url: string }>();

    for (let offset = 0; offset < uploaderIds.length; offset += 200) {
      const { data: profiles, error: profilesError } = await supabase
        .from("users")
        .select("id, display_name, avatar_url")
        .in("id", uploaderIds.slice(offset, offset + 200));

      if (profilesError) {
        console.error("Fetch documentation public profiles error:", profilesError);
        return json({ error: "Gagal mengambil profil pengunggah." }, 500);
      }

      (profiles || []).forEach((profile: any) => {
        uploaderProfiles.set(String(profile.id), {
          display_name: String(profile.display_name || "Pengunjung"),
          avatar_url: String(profile.avatar_url || ""),
        });
      });
    }

    const publicDocs = visibleDocs.map((doc: any) => {
      const profile = uploaderProfiles.get(String(doc.user_id || ""));
      return {
        id: doc.id,
        event_id: doc.event_id,
        user_id: doc.user_id,
        display_name: profile?.display_name || "Pengunjung",
        avatar_url: profile?.avatar_url || "",
        image_url: doc.image_url,
        caption: doc.caption,
        created_at: doc.created_at,
      };
    });

    return json({
      success: true,
      docs: publicDocs,
    });
  } catch (error) {
    console.error("Event documentations GET error:", error);
    return json(
      { error: "Terjadi kesalahan pada server." },
      500
    );
  }
}

// POST: Upload dokumentasi oleh pengguna yang sudah login.
export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null;

  try {
    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return json(
        { error: "Permintaan tidak diizinkan." },
        403
      );
    }

    const session = await getSession(request);

    if (!session) {
      return json(
        { error: "Sesi login tidak valid. Silakan login kembali." },
        401
      );
    }

    const formData = await request.formData();

    const eventId =
      typeof formData.get("eventId") === "string"
        ? String(formData.get("eventId")).trim()
        : "";

    const caption =
      typeof formData.get("caption") === "string"
        ? String(formData.get("caption")).trim()
        : "";

    const file = formData.get("file");

    if (
      !eventId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)
    ) {
      return json({ error: "ID event tidak valid." }, 400);
    }

    if (
      !file ||
      typeof file === "string" ||
      typeof file.arrayBuffer !== "function"
    ) {
      return json(
        { error: "File dokumentasi belum dipilih." },
        400
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return json(
        { error: "Format foto harus JPG, PNG, atau WebP." },
        400
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return json(
        { error: "Ukuran foto maksimal 10 MB." },
        400
      );
    }

    const supabase = getSupabaseAdmin();

    // Ambil identitas pengguna dari sesi yang sudah tervalidasi.
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, display_name, avatar_url")
      .eq("id", session.user_id)
      .maybeSingle();

    if (userError || !user) {
      console.error("Documentation user lookup error:", userError);
      return json(
        { error: "Data akun tidak ditemukan. Silakan login kembali." },
        401
      );
    }

    // Pastikan event benar-benar ada dan sudah selesai menurut WIB.
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, moderation_status, is_hidden, start_date, end_date, start_time, end_time")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      console.error("Documentation event lookup error:", eventError);
      return json(
        { error: "Gagal memeriksa event." },
        500
      );
    }

    if (!event) {
      return json(
        { error: "Event tidak ditemukan." },
        404
      );
    }

    if (event.moderation_status !== "Approved" || event.is_hidden !== false) {
      return json({ error: "Event tidak ditemukan." }, 404);
    }

    if (getEventTimeStatus(event) !== "Completed") {
      return json(
        { error: "Dokumentasi hanya bisa diunggah setelah event selesai." },
        400
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (
      buffer.length !== file.size ||
      !isValidImage(buffer, file.type)
    ) {
      return json(
        { error: "File bukan gambar JPG, PNG, atau WebP yang valid." },
        400
      );
    }

    const extension =
      file.type === "image/jpeg"
        ? "jpg"
        : file.type === "image/png"
          ? "png"
          : "webp";

    // Nama file acak untuk mencegah benturan nama dan overwrite.
    uploadedPath = `events/${eventId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(uploadedPath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Documentation storage upload error:", uploadError);
      uploadedPath = null;

      return json(
        { error: "Gagal mengunggah foto dokumentasi." },
        500
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uploadedPath);

    const imageUrl = publicUrlData.publicUrl;

    const displayName = user.display_name?.trim() || "Pengunjung";

    const { data, error: insertError } = await supabase
      .from("event_documentations")
      .insert({
        event_id: eventId,
        user_id: user.id,
        username: displayName,
        image_url: imageUrl,
        caption,
      })
      .select("id, event_id, user_id, image_url, caption, created_at")
      .single();

    if (insertError) {
      console.error("Insert event documentation error:", insertError);

      // Hapus file jika penyimpanan metadata gagal.
      const { error: cleanupError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([uploadedPath]);

      if (cleanupError) {
        console.error("Documentation cleanup error:", cleanupError);
      }

      uploadedPath = null;

      return json(
        { error: "Foto terunggah, tetapi data dokumentasi gagal disimpan." },
        500
      );
    }

    return json({
      success: true,
      doc: {
        id: data.id,
        event_id: data.event_id,
        user_id: data.user_id,
        display_name: displayName,
        avatar_url: user.avatar_url || "",
        image_url: data.image_url,
        caption: data.caption,
        created_at: data.created_at,
      },
    });
  } catch (error) {
    console.error("Event documentations POST error:", error);

    // Bersihkan file jika terjadi kesalahan setelah upload.
    if (uploadedPath) {
      try {
        await getSupabaseAdmin()
          .storage
          .from(BUCKET_NAME)
          .remove([uploadedPath]);
      } catch (cleanupError) {
        console.error("Documentation cleanup error:", cleanupError);
      }
    }

    return json(
      { error: "Terjadi kesalahan pada server." },
      500
    );
  }
}
