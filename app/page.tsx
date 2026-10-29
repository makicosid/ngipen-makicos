
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";

type TicketType = "Gratis" | "Berbayar";
type Category =
  | "Gratis"
  | "Berbayar"
  | "Cosplay"
  | "Idol"
  | "Toys Event"
  | "Market Event";
type ModStatus = "Pending" | "Approved" | "Rejected" | "Hidden";
type TimeStatus = "Upcoming" | "Ongoing" | "Completed";
type Role = "guest" | "user" | "admin";

interface Event {
  id: string;
  organizer_id: string;
  title: string;
  slug: string;
  description: string;
  poster_url: string;
  categories: Category[];
  province: string;
  city: string;
  venue_address: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  ticket_type: TicketType;
  ticket_url?: string;
  registration_url?: string;
  moderation_status: ModStatus;
  is_sponsored: boolean;
  sponsored_priority: number;
  sponsored_start?: string;
  sponsored_end?: string;
  views: number;
  saves_count: number;
  avg_rating: number;
  rating_count: number;
  organizer_name: string;
  created_at: string;
}

interface Doc {
  id: string;
  event_id: string;
  user_id: string;
  username: string;
  image_url: string;
  caption: string;
  created_at: string;
}

interface Review {
  id: string;
  event_id: string;
  user_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

interface RegUser {
  id: string;
  username: string;
  password_hash?: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
}

const ALL_PROVINCES = [
  "Aceh",
  "Sumatera Utara",
  "Sumatera Barat",
  "Riau",
  "Jambi",
  "Sumatera Selatan",
  "Bengkulu",
  "Lampung",
  "Kepulauan Bangka Belitung",
  "Kepulauan Riau",
  "DKI Jakarta",
  "Jawa Barat",
  "Jawa Tengah",
  "DI Yogyakarta",
  "Jawa Timur",
  "Banten",
  "Bali",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
  "Kalimantan Barat",
  "Kalimantan Tengah",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Kalimantan Utara",
  "Sulawesi Utara",
  "Sulawesi Tengah",
  "Sulawesi Selatan",
  "Sulawesi Tenggara",
  "Gorontalo",
  "Sulawesi Barat",
  "Maluku",
  "Maluku Utara",
  "Papua",
  "Papua Barat",
  "Papua Selatan",
  "Papua Tengah",
  "Papua Pegunungan",
  "Papua Barat Daya",
];

const eventCategoryOptions: Category[] = [
  "Cosplay",
  "Idol",
  "Toys Event",
  "Market Event",
];

function getTimeStatus(event: Event): TimeStatus {
  const now = new Date();
  const start = new Date(`${event.start_date}T${event.start_time}`);
  const end = new Date(`${event.end_date}T${event.end_time}`);

  if (now < start) return "Upcoming";
  if (now >= start && now < end) return "Ongoing";
  return "Completed";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function Page() {
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedProv, setSelectedProv] = useState("Semua");
  const [selectedCity, setSelectedCity] = useState("Semua");
  const [selectedCat, setSelectedCat] =
    useState<Category | "Semua">("Semua");
  const [selectedTicket, setSelectedTicket] =
    useState<TicketType | "Semua">("Semua");

  const [sortMode, setSortMode] =
    useState<"Terbaru" | "Terpopuler">("Terbaru");
  const [userTab, setUserTab] =
    useState<"Semua" | "Tersimpan">("Semua");

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const [showLoginUser, setShowLoginUser] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showRegUser, setShowRegUser] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);

  const [currentRole, setCurrentRole] = useState<Role>("guest");
  const [currentUser, setCurrentUser] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [toast, setToast] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [logoClicks, setLogoClicks] = useState(0);

  const [registeredUsers, setRegisteredUsers] = useState<RegUser[]>([]);
  const [usersLoadError, setUsersLoadError] = useState("");

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [docs, setDocs] = useState<Doc[]>([]);

  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [posterPreview, setPosterPreview] = useState("");
  const [posterError, setPosterError] = useState("");
  const [posterFile, setPosterFile] = useState<File | null>(null);

  const [newCategories, setNewCategories] = useState<Category[]>(["Cosplay"]);
  const [newTicketType, setNewTicketType] = useState<TicketType>("Gratis");

  const [adminTab, setAdminTab] =
    useState<"moderation" | "users">("moderation");
  const [sponsoredCount, setSponsoredCount] = useState(0);

  const [commentText, setCommentText] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docCaption, setDocCaption] = useState("");

  const [userAvatarFile, setUserAvatarFile] = useState<File | null>(null);

  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [avatarToCrop, setAvatarToCrop] = useState("");
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarPos, setAvatarPos] = useState({ x: 0, y: 0 });

  const avatarImgRef = useRef<HTMLImageElement>(null);

  // Tema dan sesi lokal
  useEffect(() => {
    const savedTheme = localStorage.getItem("ngipen_theme");

    if (savedTheme === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }

    const role = localStorage.getItem("ngipen_role") as Role;
    const user = localStorage.getItem("ngipen_user");
    const userId = localStorage.getItem("ngipen_user_id");

    if (role) setCurrentRole(role);
    if (user) setCurrentUser(user);
    if (userId) setCurrentUserId(userId);
  }, []);

  // Pintasan admin: Ctrl + Shift + A
  useEffect(() => {
    const handleAdminShortcut = (event: KeyboardEvent) => {
      if (
        event.ctrlKey &&
        event.shiftKey &&
        event.key.toLowerCase() === "a"
      ) {
        event.preventDefault();
        setShowAdmin(true);
      }
    };

    window.addEventListener("keydown", handleAdminShortcut);

    return () => {
      window.removeEventListener("keydown", handleAdminShortcut);
    };
  }, []);

  // Data Supabase
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);

      try {
        const { data: pinData } = await supabase
          .from("admin_settings")
          .select("*")
          .eq("setting_key", "admin_pin")
          .maybeSingle();

        if (pinData?.setting_value) {
          setAdminPin(String(pinData.setting_value).replace(/"/g, ""));
        }

        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id,username,display_name,bio,avatar_url,created_at")
          .order("created_at", { ascending: false });

        if (usersError) {
          setUsersLoadError(usersError.message);
          console.error("Gagal memuat user:", usersError.message);
        } else if (usersData) {
          setRegisteredUsers(usersData as RegUser[]);
          setUsersLoadError("");
        }

        const { data: eventsData, error: eventsError } = await supabase
          .from("events")
          .select("*")
          .order("created_at", { ascending: false });

        if (eventsError) {
          console.error("Gagal memuat event:", eventsError.message);
        } else if (eventsData) {
          setEvents(eventsData as Event[]);
          setSponsoredCount(
            eventsData.filter((event: any) => event.is_sponsored).length
          );
        }

        const savedUserId = localStorage.getItem("ngipen_user_id");

        if (savedUserId) {
          const { data: saves } = await supabase
            .from("event_saves")
            .select("*")
            .eq("user_id", savedUserId);

          if (saves) {
            setSavedIds(saves.map((save: any) => save.event_id));
          }

          const { data: userReviews } = await supabase
            .from("event_reviews")
            .select("*")
            .eq("user_id", savedUserId);

          if (userReviews) {
            const ratings: Record<string, number> = {};

            userReviews.forEach((review: any) => {
              ratings[review.event_id] = review.rating;
            });

            setMyRatings(ratings);
          }
        }

        const { data: allReviews, error: reviewsError } = await supabase
          .from("event_reviews")
          .select("*")
          .order("created_at", { ascending: false });

        if (reviewsError) {
          console.error("Gagal mengambil komentar:", reviewsError.message);
        }

        if (allReviews) {
          const userMap = new Map(
            (usersData || []).map((user: any) => [user.id, user])
          );

          setReviews(
            allReviews.map((review: any) => {
              const user: any = userMap.get(review.user_id);

              return {
                ...review,
                username: user?.username || "user",
                display_name:
                  user?.display_name || user?.username || "User",
                avatar_url: user?.avatar_url || "",
              };
            })
          );
        }

        const { data: docsData, error: docsError } = await supabase
          .from("event_documentations")
          .select("*")
          .order("created_at", { ascending: false });

        if (!docsError && docsData) {
          setDocs(docsData as Doc[]);
        } else {
          const { data: docsFallback } = await supabase
            .from("documentations")
            .select("*")
            .order("created_at", { ascending: false });

          if (docsFallback) {
            setDocs(
              docsFallback.map((doc: any) => ({
                id: doc.id,
                event_id: doc.event_id || doc.eventId,
                user_id: doc.user_id,
                username: doc.username,
                image_url: doc.image_url || doc.imageUrl,
                caption: doc.caption,
                created_at: doc.created_at,
              }))
            );
          }
        }
      } catch (error) {
        console.error("Kesalahan memuat data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, []);

  // Upload file ke Supabase Storage
  const uploadToBucket = async (
    file: File,
    bucket: string
  ): Promise<string> => {
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName =
      bucket === "avatars"
        ? `${currentUserId}/avatar-${Date.now()}-${safeName}`
        : `${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type,
      });

    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return `${data.publicUrl}?v=${Date.now()}`;
  };

  // Validasi poster: maksimal 3 MB, rasio 3:4
  const handlePosterUpload = (
    file: File,
    setter: (value: string) => void
  ) => {
    setPosterError("");

    if (!file.type.startsWith("image/")) {
      setPosterError("File harus berupa gambar.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setPosterError("Ukuran poster maksimal 3 MB.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      if (Math.abs(img.width / img.height - 0.75) > 0.1) {
        setPosterError("Rasio poster harus 3:4.");
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setPosterFile(file);
      setter(objectUrl);
    };

    img.onerror = () => {
      setPosterError("Gambar tidak dapat dibaca.");
      URL.revokeObjectURL(objectUrl);
    };

    img.src = objectUrl;
  };

  // Login user
  const handleLoginUser = async () => {
    const username = (
      document.getElementById("login-user-u") as HTMLInputElement
    )?.value?.trim().toLowerCase();

    const password = (
      document.getElementById("login-user-p") as HTMLInputElement
    )?.value;

    if (!username || !password) {
      setToast("Isi username dan password.");
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (error || !data || data.password_hash !== password) {
      setToast("Username atau password salah.");
      setTimeout(() => setToast(""), 2000);
      return;
    }

    localStorage.setItem("ngipen_role", "user");
    localStorage.setItem("ngipen_user", data.display_name);
    localStorage.setItem("ngipen_user_id", data.id);

    setCurrentRole("user");
    setCurrentUser(data.display_name);
    setCurrentUserId(data.id);

    const { data: saves } = await supabase
      .from("event_saves")
      .select("*")
      .eq("user_id", data.id);

    if (saves) setSavedIds(saves.map((save: any) => save.event_id));

    setShowLoginUser(false);
    setToast(`Halo, ${data.display_name}!`);
    setTimeout(() => setToast(""), 2000);
  };

  // Pendaftaran user
  const handleRegUser = async () => {
    const username = (
      document.getElementById("reg-user-u") as HTMLInputElement
    )?.value?.trim().toLowerCase();

    const displayName = (
      document.getElementById("reg-user-d") as HTMLInputElement
    )?.value?.trim();

    const password = (
      document.getElementById("reg-user-p") as HTMLInputElement
    )?.value;

    if (!username || username.length < 3) {
      setToast("Username minimal 3 karakter.");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      setToast("Gunakan huruf kecil, angka, atau underscore.");
      return;
    }

    if (
      !password ||
      password.length < 8 ||
      !/[a-zA-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setToast("Password minimal 8 karakter dan harus berisi huruf serta angka.");
      return;
    }

    const { data: existing, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (checkError) {
      setToast("Gagal memeriksa username.");
      return;
    }

    if (existing) {
      setToast("Username sudah digunakan.");
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .insert({
        username,
        normalized_username: username,
        password_hash: password,
        display_name: displayName || username,
        bio: "",
        avatar_url: "",
      })
      .select()
      .single();

    if (error) {
      setToast(`Gagal mendaftar: ${error.message}`);
      setTimeout(() => setToast(""), 3000);
      return;
    }

    setRegisteredUsers((prev) => [data as RegUser, ...prev]);
    setShowRegUser(false);
    setToast("Pendaftaran berhasil. Silakan masuk.");
    setTimeout(() => setToast(""), 2500);
  };

  // Login admin
  const handleLoginAdmin = async () => {
    const username = (
      document.getElementById("admin-user") as HTMLInputElement
    )?.value?.trim();

    const pin = (
      document.getElementById("admin-pin") as HTMLInputElement
    )?.value?.trim();

    if (!username || !pin) {
      setToast("Isi username dan PIN admin.");
      return;
    }

    const { data, error } = await supabase
      .from("admin_settings")
      .select("username, pin_hash")
      .eq("username", username)
      .maybeSingle();

    if (!error && data && data.pin_hash === pin) {
      localStorage.setItem("ngipen_role", "admin");
      setCurrentRole("admin");
      setShowAdmin(false);
      setToast("Login admin berhasil.");
      setTimeout(() => setToast(""), 2000);
      return;
    }

    setToast("Username atau PIN admin salah.");
    setTimeout(() => setToast(""), 2000);
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("ngipen_role");
    localStorage.removeItem("ngipen_user");
    localStorage.removeItem("ngipen_user_id");

    setCurrentRole("guest");
    setCurrentUser("");
    setCurrentUserId("");
    setSavedIds([]);
    setMyRatings({});
    setMobileOpen(false);

    setToast("Kamu telah keluar.");
    setTimeout(() => setToast(""), 2000);
  };

  // Membuat atau memperbarui event
  const handleCreateEvent = async () => {
    const title = (
      document.getElementById("new-title") as HTMLInputElement
    )?.value?.trim();

    const description = (
      document.getElementById("new-desc") as HTMLTextAreaElement
    )?.value?.trim();

    const province = (
      document.getElementById("new-prov") as HTMLSelectElement
    )?.value;

    const city = (
      document.getElementById("new-city") as HTMLInputElement
    )?.value?.trim();

    const venue = (
      document.getElementById("new-venue") as HTMLInputElement
    )?.value?.trim();

    const ticketUrl = (
      document.getElementById("new-ticket-url") as HTMLInputElement
    )?.value?.trim();

    const registrationUrl = (
      document.getElementById("new-lomba-url") as HTMLInputElement
    )?.value?.trim();

    const startDate = (
      document.getElementById("new-start") as HTMLInputElement
    )?.value;

    const endDate = (
      document.getElementById("new-end") as HTMLInputElement
    )?.value;

    const startTime =
      (document.getElementById("new-start-time") as HTMLInputElement)?.value ||
      "09:00";

    const endTime =
      (document.getElementById("new-end-time") as HTMLInputElement)?.value ||
      "18:00";

    if (!title || title.length < 3) {
      setToast("Judul minimal 3 karakter.");
      return;
    }

    if (!description || description.length < 20) {
      setToast("Deskripsi minimal 20 karakter.");
      return;
    }

    if (!posterFile && !editingEvent) {
      setToast("Poster event wajib diunggah.");
      return;
    }

    if (newCategories.length === 0) {
      setToast("Pilih minimal satu kategori.");
      return;
    }

    if (newTicketType === "Berbayar" && !ticketUrl) {
      setToast("Link tiket wajib untuk event berbayar.");
      return;
    }

    if (!startDate || !endDate || endDate < startDate) {
      setToast("Periksa kembali tanggal event.");
      return;
    }

    if (currentRole !== "user" || !currentUserId) {
      setToast("Silakan login sebelum mengunggah event.");
      setShowLoginUser(true);
      return;
    }

    try {
      let posterUrl = editingEvent?.poster_url || "";

      if (posterFile) {
        posterUrl = await uploadToBucket(posterFile, "posters");
      }

      const payload = {
        organizer_id: currentUserId,
        title,
        slug: slugify(title),
        description,
        poster_url: posterUrl,
        categories: newCategories,
        province,
        city,
        venue_address: venue,
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        ticket_type: newTicketType,
        ticket_url: ticketUrl || null,
        registration_url: registrationUrl || null,
        moderation_status: "Pending",
        is_sponsored: false,
        sponsored_priority: 0,
        views: 0,
        saves_count: 0,
        avg_rating: 0,
        rating_count: 0,
        organizer_name: currentUser,
      };

      if (editingEvent) {
        const { data, error } = await supabase
          .from("events")
          .update(payload)
          .eq("id", editingEvent.id)
          .eq("organizer_id", currentUserId)
          .select()
          .single();

        if (error) throw error;

        setEvents((prev) =>
          prev.map((event) =>
            event.id === editingEvent.id ? (data as Event) : event
          )
        );

        setToast("Event diperbarui dan menunggu persetujuan.");
      } else {
        const { data, error } = await supabase
          .from("events")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;

        setEvents((prev) => [data as Event, ...prev]);
        setToast("Event dikirim dan menunggu persetujuan admin.");
      }

      setEventFormOpen(false);
      setEditingEvent(null);
      setPosterFile(null);
      setPosterPreview("");
      setPosterError("");
    } catch (error: any) {
      setToast(`Gagal menyimpan event: ${error.message}`);
    }

    setTimeout(() => setToast(""), 3000);
  };

  // Moderasi event dan penandaan sponsor
  const handleModeration = async (
    id: string,
    status: ModStatus,
    sponsor?: boolean,
    priority?: number
  ) => {
    const update: Record<string, any> = { moderation_status: status };

    if (sponsor !== undefined) update.is_sponsored = sponsor;
    if (priority !== undefined) update.sponsored_priority = priority;

    if (sponsor) {
      update.sponsored_start = new Date().toISOString();

      const end = new Date();
      end.setDate(end.getDate() + 30);
      update.sponsored_end = end.toISOString();
    }

    const { error } = await supabase
      .from("events")
      .update(update)
      .eq("id", id);

    if (error) {
      setToast(`Gagal memperbarui event: ${error.message}`);
      return;
    }

    setEvents((prev) =>
      prev.map((event) =>
        event.id === id ? { ...event, ...update } : event
      )
    );

    setToast(`Status event: ${status}`);
    setTimeout(() => setToast(""), 2000);
  };

  // Simpan atau hapus event dari daftar tersimpan
  const toggleSave = async (eventId: string) => {
    if (currentRole !== "user") {
      setShowLoginUser(true);
      return;
    }

    const isSaved = savedIds.includes(eventId);

    if (isSaved) {
      const { error } = await supabase
        .from("event_saves")
        .delete()
        .eq("user_id", currentUserId)
        .eq("event_id", eventId);

      if (error) {
        setToast("Gagal menghapus event tersimpan.");
        return;
      }

      setSavedIds((prev) => prev.filter((id) => id !== eventId));

      setEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? { ...event, saves_count: Math.max(0, event.saves_count - 1) }
            : event
        )
      );
    } else {
      const { error } = await supabase.from("event_saves").insert({
        user_id: currentUserId,
        event_id: eventId,
      });

      if (error) {
        setToast("Gagal menyimpan event.");
        return;
      }

      setSavedIds((prev) => [...prev, eventId]);

      setEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? { ...event, saves_count: event.saves_count + 1 }
            : event
        )
      );
    }
  };

  // Penilaian event
  const handleRate = async (eventId: string, rating: number) => {
    if (currentRole !== "user") {
      setShowLoginUser(true);
      return;
    }

    const { data: existing } = await supabase
      .from("event_reviews")
      .select("*")
      .eq("user_id", currentUserId)
      .eq("event_id", eventId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("event_reviews")
        .update({ rating })
        .eq("id", existing.id);
    } else {
      await supabase.from("event_reviews").insert({
        user_id: currentUserId,
        event_id: eventId,
        rating,
      });
    }

    setMyRatings((prev) => ({ ...prev, [eventId]: rating }));

    const { data: allReviews } = await supabase
      .from("event_reviews")
      .select("*")
      .eq("event_id", eventId);

    if (allReviews?.length) {
      const average =
        allReviews.reduce((sum: number, review: any) => sum + review.rating, 0) /
        allReviews.length;

      await supabase
        .from("events")
        .update({
          avg_rating: average,
          rating_count: allReviews.length,
        })
        .eq("id", eventId);

      setEvents((prev) =>
        prev.map((event) =>
          event.id === eventId
            ? {
                ...event,
                avg_rating: average,
                rating_count: allReviews.length,
              }
            : event
        )
      );
    }
  };

  // Tambah atau perbarui komentar event
  const handleAddComment = async () => {
    if (!selectedEvent) return;

    if (currentRole !== "user") {
      setShowLoginUser(true);
      return;
    }

    if (!commentText.trim() && !myRatings[selectedEvent.id]) {
      setToast("Rating atau komentar wajib diisi.");
      setTimeout(() => setToast(""), 2000);
      return;
    }

    const { data: existing } = await supabase
      .from("event_reviews")
      .select("*")
      .eq("user_id", currentUserId)
      .eq("event_id", selectedEvent.id)
      .maybeSingle();

    let saveError: any = null;

    if (existing) {
      const { error } = await supabase
        .from("event_reviews")
        .update({
          rating: myRatings[selectedEvent.id] || existing.rating,
          comment: commentText.trim() || existing.comment || "",
        })
        .eq("id", existing.id);

      saveError = error;
    } else {
      const { error } = await supabase.from("event_reviews").insert({
        user_id: currentUserId,
        event_id: selectedEvent.id,
        rating: myRatings[selectedEvent.id] || 5,
        comment: commentText.trim(),
      });

      saveError = error;
    }

    if (saveError) {
      setToast(`Gagal menyimpan komentar: ${saveError.message}`);
      setTimeout(() => setToast(""), 3000);
      return;
    }

    setCommentText("");
    setToast("Komentar dan rating tersimpan.");
    setTimeout(() => setToast(""), 2000);

    const { data: allReviews } = await supabase
      .from("event_reviews")
      .select("*")
      .eq("event_id", selectedEvent.id)
      .order("created_at", { ascending: false });

    if (allReviews) {
      const userMap = new Map(
        registeredUsers.map((user) => [user.id, user])
      );

      const mappedReviews = allReviews.map((review: any) => {
        const user: any = userMap.get(review.user_id);

        return {
          ...review,
          username: user?.username || "user",
          display_name: user?.display_name || user?.username || "User",
          avatar_url: user?.avatar_url || "",
        };
      });

      setReviews((prev) => [
        ...mappedReviews,
        ...prev.filter((review) => review.event_id !== selectedEvent.id),
      ]);

      if (allReviews.length > 0) {
        const average =
          allReviews.reduce(
            (sum: number, review: any) => sum + review.rating,
            0
          ) / allReviews.length;

        await supabase
          .from("events")
          .update({
            avg_rating: average,
            rating_count: allReviews.length,
          })
          .eq("id", selectedEvent.id);

        setEvents((prev) =>
          prev.map((event) =>
            event.id === selectedEvent.id
              ? {
                  ...event,
                  avg_rating: average,
                  rating_count: allReviews.length,
                }
              : event
          )
        );

        setSelectedEvent((prev) =>
          prev
            ? {
                ...prev,
                avg_rating: average,
                rating_count: allReviews.length,
              }
            : null
        );
      }
    }
  };

  // Upload dokumentasi setelah event selesai
  const handleUploadDoc = async () => {
    if (!selectedEvent) return;

    if (currentRole !== "user") {
      setShowLoginUser(true);
      return;
    }

    if (getTimeStatus(selectedEvent) !== "Completed") {
      setToast("Dokumentasi hanya bisa diunggah setelah event selesai.");
      setTimeout(() => setToast(""), 2000);
      return;
    }

    if (!docFile) {
      setToast("Pilih foto dokumentasi.");
      return;
    }

    if (docFile.size > 10 * 1024 * 1024) {
      setToast("Ukuran foto maksimal 10 MB.");
      return;
    }

    try {
      const imageUrl = await uploadToBucket(docFile, "documentations");

      const { data, error } = await supabase
        .from("event_documentations")
        .insert({
          event_id: selectedEvent.id,
          user_id: currentUserId,
          username: currentUser,
          image_url: imageUrl,
          caption: docCaption,
        })
        .select()
        .single();

      if (error) throw error;

      setDocs((prev) => [data as Doc, ...prev]);
      setDocFile(null);
      setDocCaption("");
      setToast("Dokumentasi berhasil diunggah.");
    } catch (error: any) {
      setToast(`Gagal mengunggah dokumentasi: ${error.message}`);
    }

    setTimeout(() => setToast(""), 2500);
  };

  // Simpan perubahan profil user
  const handleUpdateUserProfile = async () => {
    if (!currentUserId) {
      setToast("Sesi user tidak ditemukan. Silakan login ulang.");
      return;
    }

    const displayName = (
      document.getElementById("edit-user-display") as HTMLInputElement
    )?.value?.trim();

    const bio = (
      document.getElementById("edit-user-bio") as HTMLTextAreaElement
    )?.value?.trim() || "";

    if (!displayName) {
      setToast("Nama profil wajib diisi.");
      return;
    }

    let avatarUrl =
      registeredUsers.find((user) => user.id === currentUserId)?.avatar_url ||
      "";

    if (userAvatarFile) {
      try {
        avatarUrl = await uploadToBucket(userAvatarFile, "avatars");
      } catch (error: any) {
        setToast(`Gagal mengunggah avatar: ${error.message}`);
        return;
      }
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        display_name: displayName,
        bio,
        avatar_url: avatarUrl,
      })
      .eq("id", currentUserId)
      .select("*")
      .maybeSingle();

    if (error) {
      setToast(`Gagal menyimpan profil: ${error.message}`);
      return;
    }

    const updated = {
      id: currentUserId,
      username: currentUser,
      display_name: displayName,
      bio,
      avatar_url: avatarUrl,
      ...(data || {}),
    } as RegUser;

    setRegisteredUsers((prev) =>
      prev.map((user) => (user.id === currentUserId ? updated : user))
    );

    setCurrentUser(displayName);
    localStorage.setItem("ngipen_user", displayName);
    setUserAvatarFile(null);
    setShowUserProfile(false);
    setToast("Profil berhasil diperbarui.");
    setTimeout(() => setToast(""), 2000);
  };

  // Ganti password
  const handleChangeUserPassword = async () => {
    const oldPassword = (
      document.getElementById("edit-user-oldpass") as HTMLInputElement
    )?.value;

    const newPassword = (
      document.getElementById("edit-user-newpass") as HTMLInputElement
    )?.value;

    const { data, error } = await supabase
      .from("users")
      .select("password_hash")
      .eq("id", currentUserId)
      .maybeSingle();

    if (error || !data || data.password_hash !== oldPassword) {
      setToast("Password lama salah.");
      return;
    }

    if (
      !newPassword ||
      newPassword.length < 8 ||
      !/[a-zA-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      setToast("Password baru minimal 8 karakter dan berisi huruf serta angka.");
      return;
    }

    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash: newPassword })
      .eq("id", currentUserId);

    if (updateError) {
      setToast(`Gagal mengganti password: ${updateError.message}`);
      return;
    }

    setToast("Password berhasil diganti.");
    setTimeout(() => setToast(""), 2000);
  };

  // Crop avatar menjadi gambar persegi 512 x 512
  const handleAvatarCropSave = async () => {
    const img = avatarImgRef.current;

    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) {
      setToast("Foto belum siap diproses.");
      return;
    }

    const canvas = document.createElement("canvas");
    const size = 512;

    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fitScale = Math.max(
      size / img.naturalWidth,
      size / img.naturalHeight
    );

    const scale = fitScale * avatarZoom;
    const sourceSize = size / scale;

    const sx = (img.naturalWidth - sourceSize) / 2 - avatarPos.x / scale;
    const sy = (img.naturalHeight - sourceSize) / 2 - avatarPos.y / scale;

    const safeSx = Math.max(
      0,
      Math.min(img.naturalWidth - sourceSize, sx)
    );

    const safeSy = Math.max(
      0,
      Math.min(img.naturalHeight - sourceSize, sy)
    );

    ctx.drawImage(
      img,
      safeSx,
      safeSy,
      Math.min(sourceSize, img.naturalWidth),
      Math.min(sourceSize, img.naturalHeight),
      0,
      0,
      size,
      size
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setToast("Gagal memproses crop avatar.");
          return;
        }

        if (blob.size > 3 * 1024 * 1024) {
          setToast("Hasil crop melebihi 3 MB.");
          return;
        }

        const file = new File([blob], `avatar-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        setUserAvatarFile(file);
        setShowAvatarCrop(false);
        setToast("Avatar siap. Klik Simpan Profil.");
        setTimeout(() => setToast(""), 2500);
      },
      "image/jpeg",
      0.88
    );
  };

  // Event publik: user tidak melihat dashboard pengelolaan event
  const approvedEvents = useMemo(
    () =>
      events.filter((event) => event.moderation_status === "Approved"),
    [events]
  );

  // Event sponsor hanya dari event yang telah disetujui admin
  const sponsoredEvents = useMemo(
    () =>
      approvedEvents
        .filter((event) => event.is_sponsored === true)
        .sort(
          (a, b) =>
            (b.sponsored_priority || 0) - (a.sponsored_priority || 0)
        )
        .slice(0, 10),
    [approvedEvents]
  );

  const filteredEvents = useMemo(() => {
    let result = [...approvedEvents];

    if (userTab === "Tersimpan") {
      result = result.filter((event) => savedIds.includes(event.id));
    }

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter((event) =>
        [
          event.title,
          event.description,
          event.city,
          event.province,
          event.venue_address,
          event.organizer_name,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query))
      );
    }

    if (selectedProv !== "Semua") {
      result = result.filter((event) => event.province === selectedProv);
    }

    if (selectedCity !== "Semua") {
      result = result.filter((event) => event.city === selectedCity);
    }

    if (selectedCat !== "Semua") {
      result = result.filter((event) =>
        event.categories?.includes(selectedCat as Category)
      );
    }

    if (selectedTicket !== "Semua") {
      result = result.filter((event) => event.ticket_type === selectedTicket);
    }

    if (sortMode === "Terpopuler") {
      result.sort(
        (a, b) =>
          (b.views || 0) + (b.saves_count || 0) -
          ((a.views || 0) + (a.saves_count || 0))
      );
    } else {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      );
    }

    return result;
  }, [
    approvedEvents,
    userTab,
    savedIds,
    search,
    selectedProv,
    selectedCity,
    selectedCat,
    selectedTicket,
    sortMode,
  ]);

  const cities = useMemo(
    () =>
      Array.from(
        new Set(
          approvedEvents
            .filter(
              (event) =>
                selectedProv === "Semua" || event.province === selectedProv
            )
            .map((event) => event.city)
            .filter(Boolean)
        )
      ).sort(),
    [approvedEvents, selectedProv]
  );

  const openEvent = async (event: Event) => {
    setSelectedEvent(event);
    setCommentText("");

    const { data } = await supabase
      .from("event_reviews")
      .select("*")
      .eq("event_id", event.id)
      .order("created_at", { ascending: false });

    if (data) {
      setReviews((prev) => [
        ...data,
        ...prev.filter((review) => review.event_id !== event.id),
      ]);
    }
  };

  const toggleTheme = () => {
    const next = !dark;

    setDark(next);
    localStorage.setItem("ngipen_theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-white">
        {/* HEADER */}
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3">
            {/* LOGO */}
            <button
              type="button"
              onClick={() => {
                const next = logoClicks + 1;
                setLogoClicks(next);

                if (next >= 5) {
                  setShowAdmin(true);
                  setLogoClicks(0);
                }

                setTimeout(() => setLogoClicks(0), 4000);
              }}
              className="flex min-w-0 items-center gap-2 text-left"
              aria-label="NGIPEN"
              title="NGIPEN"
            >
              <img
                src="/logo.png"
                alt="Logo NGIPEN"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
                className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
              />

              <span className="min-w-0">
                <span className="block text-xl font-black tracking-wide text-red-600 sm:text-2xl">
                  NGIPEN
                </span>
                <span className="hidden text-xs text-gray-500 dark:text-gray-400 sm:block">
                  Satu hobby satu keseruan
                </span>
              </span>
            </button>

            {/* NAVIGASI DESKTOP */}
            <nav className="hidden items-center gap-4 md:flex">
              <button
                onClick={() => {
                  setSelectedEvent(null);
                  setUserTab("Semua");
                }}
                className="text-sm font-semibold hover:text-red-600"
              >
                Beranda
              </button>

              <button
                onClick={() =>
                  document
                    .getElementById("daftar-event")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="text-sm font-semibold hover:text-red-600"
              >
                Jelajahi Event
              </button>

              {currentRole === "user" && (
                <button
                  onClick={() => {
                    setEditingEvent(null);
                    setPosterFile(null);
                    setPosterPreview("");
                    setPosterError("");
                    setEventFormOpen(true);
                  }}
                  className="text-sm font-semibold text-red-600 hover:text-red-700"
                >
                  + Upload Event
                </button>
              )}

              {currentRole === "admin" && (
                <button
                  onClick={() => setShowAdmin(true)}
                  className="text-sm font-bold text-red-600"
                >
                  Panel Admin
                </button>
              )}
            </nav>

            {/* AKSI DESKTOP */}
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-full border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                aria-label="Ganti tema"
                title="Ganti tema"
              >
                {dark ? "☀️" : "🌙"}
              </button>

              {currentRole === "guest" ? (
                <>
                  <button
                    onClick={() => setShowLoginUser(true)}
                    className="rounded-full border border-gray-300 px-4 py-2 text-sm font-bold dark:border-gray-700"
                  >
                    Masuk
                  </button>

                  <button
                    onClick={() => setShowRegUser(true)}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                  >
                    Daftar
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowUserProfile(true)}
                    className="max-w-36 truncate rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold dark:border-gray-700"
                  >
                    {currentUser || "Akun"}
                  </button>

                  <button
                    onClick={logout}
                    className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold dark:bg-gray-800"
                  >
                    Keluar
                  </button>
                </>
              )}
            </div>

            {/* NAVIGASI MOBILE */}
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700"
                aria-label="Ganti tema"
              >
                {dark ? "☀️" : "🌙"}
              </button>

              {currentRole === "guest" ? (
                <>
                  <button
                    onClick={() => setShowLoginUser(true)}
                    className="rounded-full border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700"
                  >
                    Masuk
                  </button>

                  <button
                    onClick={() => setShowRegUser(true)}
                    className="rounded-full bg-red-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    Daftar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowUserProfile(true)}
                  className="max-w-24 truncate rounded-full border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700"
                >
                  {currentUser || "Akun"}
                </button>
              )}

              <button
                onClick={() => setMobileOpen((open) => !open)}
                aria-label="Buka navigasi"
                aria-expanded={mobileOpen}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-xl dark:border-gray-700"
              >
                {mobileOpen ? "×" : "☰"}
              </button>
            </div>
          </div>

          {/* MENU MOBILE */}
          {mobileOpen && (
            <div className="border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-950 md:hidden">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setSelectedEvent(null);
                    setMobileOpen(false);
                    setUserTab("Semua");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="rounded-xl px-3 py-3 text-left font-semibold hover:bg-gray-100 dark:hover:bg-gray-900"
                >
                  Beranda
                </button>

                <button
                  onClick={() => {
                    setMobileOpen(false);
                    document
                      .getElementById("daftar-event")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="rounded-xl px-3 py-3 text-left font-semibold hover:bg-gray-100 dark:hover:bg-gray-900"
                >
                  Jelajahi Event
                </button>

                {currentRole === "user" && (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      setEditingEvent(null);
                      setPosterFile(null);
                      setPosterPreview("");
                      setPosterError("");
                      setEventFormOpen(true);
                    }}
                    className="rounded-xl bg-red-600 px-3 py-3 text-left font-bold text-white"
                  >
                    + Upload Poster Event
                  </button>
                )}

                {currentRole === "admin" && (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      setShowAdmin(true);
                    }}
                    className="rounded-xl px-3 py-3 text-left font-bold text-red-600 hover:bg-gray-100 dark:hover:bg-gray-900"
                  >
                    Panel Admin
                  </button>
                )}

                {currentRole !== "guest" && (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="rounded-xl px-3 py-3 text-left font-semibold hover:bg-gray-100 dark:hover:bg-gray-900"
                  >
                    Keluar
                  </button>
                )}
              </div>
            </div>
          )}
        </header>

        {/* BERANDA */}
        {!selectedEvent && (
          <main>
            {/* HERO */}
            <section className="mx-auto max-w-[1400px] px-4 pb-6 pt-8 sm:pt-12">
              <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-red-700 via-red-600 to-red-500 p-6 text-white sm:p-10">
                <div className="max-w-3xl">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-red-100">
                    Event Jejepangan Indonesia
                  </p>

                  <h1 className="text-3xl font-black leading-tight sm:text-5xl">
                    Temukan Keseruan Event Favoritmu!
                  </h1>

                  <p className="mt-4 max-w-2xl text-sm leading-6 text-red-50 sm:text-base">
                    Cari event cosplay, idol, toys, dan berbagai kegiatan
                    komunitas di seluruh Indonesia dalam satu tempat.
                  </p>

                  <button
                    onClick={() =>
                      document
                        .getElementById("daftar-event")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-50"
                  >
                    Jelajahi Event ↓
                  </button>
                </div>
              </div>
            </section>

            {/* UPLOAD EVENT UNTUK USER — TANPA DASHBOARD EVENT MILIK USER */}
            {currentRole === "user" && (
              <section className="mx-auto max-w-[1400px] px-4 pb-6">
                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-bold">Punya event untuk dibagikan?</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Unggah poster dan detail event. Event akan ditinjau
                      admin sebelum ditampilkan secara publik.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setEditingEvent(null);
                      setPosterFile(null);
                      setPosterPreview("");
                      setPosterError("");
                      setEventFormOpen(true);
                    }}
                    className="shrink-0 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
                  >
                    + Upload Poster Event
                  </button>
                </div>
              </section>
            )}

            {/* CAROUSEL SPONSOR / PROMOTE */}
            {sponsoredEvents.length > 0 && (
              <section className="mx-auto max-w-[1400px] px-4 pb-8">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-red-600">
                      Pilihan Partner
                    </p>
                    <h2 className="mt-1 text-xl font-black sm:text-2xl">
                      Event Promote
                    </h2>
                  </div>

                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                    ★ Sponsor
                  </span>
                </div>

                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3">
                  {sponsoredEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => openEvent(event)}
                      className="w-40 shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 sm:w-52"
                    >
                      <div className="relative aspect-[3/4] bg-gray-100 dark:bg-gray-800">
                        {event.poster_url ? (
                          <img
                            src={event.poster_url}
                            alt={`Poster ${event.title}`}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-gray-500">
                            Poster tidak tersedia
                          </div>
                        )}

                        <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black text-gray-950">
                          ★ SPONSOR
                        </span>
                      </div>

                      <div className="p-3">
                        <h3 className="line-clamp-2 min-h-10 text-sm font-bold">
                          {event.title}
                        </h3>

                        <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
                          {event.city}, {event.province}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-red-600">
                          {event.start_date}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* PANEL ADMIN */}
            {currentRole === "admin" && (
              <section className="mx-auto max-w-[1400px] px-4 pb-8">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-red-700 dark:text-red-300">
                        Panel Admin NGIPEN
                      </h2>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        Kelola persetujuan event dan status sponsor.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowAdmin(true)}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
                    >
                      Buka Panel
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white p-4 dark:bg-gray-900">
                      <p className="text-xs text-gray-500">Total event</p>
                      <p className="mt-1 text-2xl font-black">
                        {events.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white p-4 dark:bg-gray-900">
                      <p className="text-xs text-gray-500">Event sponsor</p>
                      <p className="mt-1 text-2xl font-black">
                        {sponsoredCount}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* FILTER DAN DAFTAR EVENT */}
            <section
              id="daftar-event"
              className="mx-auto max-w-[1400px] px-4 pb-12"
            >
              <div className="mb-5">
                <h2 className="text-2xl font-black sm:text-3xl">
                  Jelajahi Event
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Temukan kegiatan yang sesuai dengan minatmu.
                </p>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nama event, kota..."
                  className="min-w-0 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900"
                />

                <select
                  value={selectedProv}
                  onChange={(event) => {
                    setSelectedProv(event.target.value);
                    setSelectedCity("Semua");
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="Semua">Semua Provinsi</option>
                  {ALL_PROVINCES.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedCity}
                  onChange={(event) => setSelectedCity(event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="Semua">Semua Kota</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedCat}
                  onChange={(event) =>
                    setSelectedCat(event.target.value as Category | "Semua")
                  }
                  className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="Semua">Semua Kategori</option>
                  {eventCategoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedTicket}
                  onChange={(event) =>
                    setSelectedTicket(
                      event.target.value as TicketType | "Semua"
                    )
                  }
                  className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="Semua">Gratis & Berbayar</option>
                  <option value="Gratis">Gratis</option>
                  <option value="Berbayar">Berbayar</option>
                </select>
              </div>

              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setUserTab("Semua")}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                      userTab === "Semua"
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                    }`}
                  >
                    Semua Event
                  </button>

                  {currentRole === "user" && (
                    <button
                      onClick={() => setUserTab("Tersimpan")}
                      className={`rounded-full px-4 py-2 text-sm font-bold ${
                        userTab === "Tersimpan"
                          ? "bg-red-600 text-white"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                      }`}
                    >
                      ♥ Tersimpan
                    </button>
                  )}
                </div>

                <select
                  value={sortMode}
                  onChange={(event) =>
                    setSortMode(
                      event.target.value as "Terbaru" | "Terpopuler"
                    )
                  }
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                >
                  <option value="Terbaru">Terbaru</option>
                  <option value="Terpopuler">Terpopuler</option>
                </select>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-500 dark:border-gray-800">
                  Memuat event...
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-gray-700">
                  <p className="text-lg font-bold">Belum ada event ditemukan</p>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Coba ubah filter pencarian atau kunjungi kembali nanti.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                  {filteredEvents.map((event) => (
                    <article
                      key={event.id}
                      className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
                    >
                      <button
                        type="button"
                        onClick={() => openEvent(event)}
                        className="block w-full text-left"
                      >
                        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-gray-800">
                          {event.poster_url ? (
                            <img
                              src={event.poster_url}
                              alt={`Poster ${event.title}`}
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center p-3 text-center text-xs text-gray-500">
                              Poster belum tersedia
                            </div>
                          )}

                          {event.is_sponsored && (
                            <span className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-black text-gray-950">
                              ★ PROMOTE
                            </span>
                          )}

                          <span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-bold text-white">
                            {event.ticket_type}
                          </span>
                        </div>

                        <div className="p-3">
                          <h3 className="line-clamp-2 min-h-10 text-sm font-bold">
                            {event.title}
                          </h3>

                          <p className="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
                            📍 {event.city}, {event.province}
                          </p>

                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            📅 {event.start_date}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-1">
                            {(event.categories || []).slice(0, 2).map((cat) => (
                              <span
                                key={cat}
                                className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2 dark:border-gray-800">
                        <span className="text-xs text-gray-500">
                          ★ {(event.avg_rating || 0).toFixed(1)}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleSave(event.id)}
                          aria-label={
                            savedIds.includes(event.id)
                              ? "Hapus dari tersimpan"
                              : "Simpan event"
                          }
                          className={`rounded-lg px-3 py-1 text-sm ${
                            savedIds.includes(event.id)
                              ? "text-red-600"
                              : "text-gray-500 hover:text-red-600"
                          }`}
                        >
                          {savedIds.includes(event.id) ? "♥" : "♡"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </main>
        )}

        {/* HALAMAN DETAIL EVENT */}
        {selectedEvent && (
          <main className="mx-auto min-h-screen max-w-[1200px] px-4 py-6 sm:py-10">
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold hover:border-red-500 hover:text-red-600 dark:border-gray-700 dark:bg-gray-900"
            >
              ← Kembali ke daftar event
            </button>

            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-10">
              {/* POSTER EVENT */}
              <div className="mx-auto w-full max-w-[520px]">
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  {selectedEvent.poster_url ? (
                    <img
                      src={selectedEvent.poster_url}
                      alt={`Poster ${selectedEvent.title}`}
                      className="max-h-[780px] w-full object-contain"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center text-sm text-gray-500">
                      Poster tidak tersedia
                    </div>
                  )}
                </div>

                {selectedEvent.is_sponsored && (
                  <div className="mt-3 rounded-xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    ★ Event Promote
                  </div>
                )}
              </div>

              {/* INFORMASI EVENT */}
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  {(selectedEvent.categories || []).map((category) => (
                    <span
                      key={category}
                      className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-950 dark:text-red-300"
                    >
                      {category}
                    </span>
                  ))}

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold dark:bg-gray-800">
                    {selectedEvent.ticket_type}
                  </span>
                </div>

                <h1 className="mt-4 text-2xl font-black leading-tight sm:text-4xl">
                  {selectedEvent.title}
                </h1>

                <div className="mt-5 space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Tanggal
                    </p>
                    <p className="mt-1 font-semibold">
                      📅 {selectedEvent.start_date}
                      {selectedEvent.end_date !== selectedEvent.start_date
                        ? ` — ${selectedEvent.end_date}`
                        : ""}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Waktu
                    </p>
                    <p className="mt-1 font-semibold">
                      🕒 {selectedEvent.start_time} – {selectedEvent.end_time}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Lokasi
                    </p>
                    <p className="mt-1 font-semibold">
                      📍 {selectedEvent.venue_address || selectedEvent.city},{" "}
                      {selectedEvent.province}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Penyelenggara
                    </p>
                    <p className="mt-1 font-semibold">
                      {selectedEvent.organizer_name || "Penyelenggara event"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status event
                    </p>
                    <p className="mt-1 font-semibold">
                      {getTimeStatus(selectedEvent) === "Upcoming"
                        ? "🟢 Akan datang"
                        : getTimeStatus(selectedEvent) === "Ongoing"
                          ? "🔴 Sedang berlangsung"
                          : "⚪ Selesai"}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h2 className="text-lg font-black">Tentang Event</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-300">
                    {selectedEvent.description}
                  </p>
                </div>

                {/* TOMBOL AKSI */}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSave(selectedEvent.id)}
                    className={`rounded-xl px-4 py-3 text-sm font-bold ${
                      savedIds.includes(selectedEvent.id)
                        ? "border border-red-600 text-red-600"
                        : "border border-gray-300 dark:border-gray-700"
                    }`}
                  >
                    {savedIds.includes(selectedEvent.id)
                      ? "♥ Tersimpan"
                      : "♡ Simpan Event"}
                  </button>

                  {selectedEvent.ticket_type === "Berbayar" &&
                    selectedEvent.ticket_url && (
                      <a
                        href={selectedEvent.ticket_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
                      >
                        Beli Tiket ↗
                      </a>
                    )}

                  {selectedEvent.registration_url && (
                    <a
                      href={selectedEvent.registration_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold hover:border-red-500 dark:border-gray-700"
                    >
                      Link Pendaftaran ↗
                    </a>
                  )}
                </div>

                {/* RATING */}
                <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                  <h2 className="text-lg font-black">Rating Event</h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-2xl font-black text-amber-500">
                      ★ {(selectedEvent.avg_rating || 0).toFixed(1)}
                    </span>
                    <span className="text-sm text-gray-500">
                      ({selectedEvent.rating_count || 0} penilaian)
                    </span>
                  </div>

                  <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                    Berikan penilaianmu:
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => handleRate(selectedEvent.id, rating)}
                        aria-label={`Beri rating ${rating}`}
                        className={`text-3xl transition hover:scale-110 ${
                          (myRatings[selectedEvent.id] || 0) >= rating
                            ? "text-amber-400"
                            : "text-gray-300 dark:text-gray-700"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* KOMENTAR */}
            <section className="mt-10">
              <h2 className="text-xl font-black">
                Komentar dan Pengalaman Pengunjung
              </h2>

              {currentRole === "user" ? (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <label
                    htmlFor="event-comment"
                    className="text-sm font-bold"
                  >
                    Tulis komentar
                  </label>

                  <textarea
                    id="event-comment"
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder="Bagikan pengalaman atau pendapatmu tentang event ini..."
                    rows={4}
                    maxLength={1500}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">
                      {commentText.length}/1500 karakter
                    </span>

                    <button
                      type="button"
                      onClick={handleAddComment}
                      className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
                    >
                      Kirim Komentar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-gray-100 p-5 dark:bg-gray-900">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Login untuk memberikan rating dan menulis komentar.
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowLoginUser(true)}
                    className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
                  >
                    Masuk
                  </button>
                </div>
              )}

              <div className="mt-5 space-y-3">
                {reviews.filter(
                  (review) => review.event_id === selectedEvent.id
                ).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                    Belum ada komentar untuk event ini.
                  </p>
                ) : (
                  reviews
                    .filter((review) => review.event_id === selectedEvent.id)
                    .map((review) => (
                      <article
                        key={review.id}
                        className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
                      >
                        <div className="flex items-start gap-3">
                          {review.avatar_url ? (
                            <img
                              src={review.avatar_url}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                              {(review.display_name ||
                                review.username ||
                                "U")[0].toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-bold">
                                {review.display_name ||
                                  review.username ||
                                  "Pengguna"}
                              </p>

                              <span className="text-xs text-gray-500">
                                {review.created_at
                                  ? new Date(
                                      review.created_at
                                    ).toLocaleDateString("id-ID")
                                  : ""}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-amber-500">
                              {"★".repeat(
                                Math.min(5, Math.max(0, review.rating || 0))
                              )}
                              <span className="ml-2 text-xs text-gray-500">
                                {review.rating}/5
                              </span>
                            </p>

                            {review.comment && (
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">
                                {review.comment}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    ))
                )}
              </div>
            </section>

            {/* DOKUMENTASI EVENT */}
            <section className="mt-10">
              <div>
                <h2 className="text-xl font-black">Dokumentasi Event</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Foto kegiatan yang dibagikan oleh pengunjung setelah event
                  selesai.
                </p>
              </div>

              {currentRole === "user" &&
                getTimeStatus(selectedEvent) === "Completed" && (
                  <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                    <label
                      htmlFor="documentation-file"
                      className="text-sm font-bold"
                    >
                      Unggah foto dokumentasi
                    </label>

                    <input
                      id="documentation-file"
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        setDocFile(event.target.files?.[0] || null)
                      }
                      className="mt-3 block w-full text-sm"
                    />

                    <input
                      value={docCaption}
                      onChange={(event) => setDocCaption(event.target.value)}
                      maxLength={300}
                      placeholder="Caption foto (opsional)"
                      className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm dark:border-gray-700 dark:bg-gray-950"
                    />

                    <button
                      type="button"
                      onClick={handleUploadDoc}
                      className="mt-3 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white"
                    >
                      Unggah Dokumentasi
                    </button>
                  </div>
                )}

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {docs
                  .filter((doc) => doc.event_id === selectedEvent.id)
                  .map((doc) => (
                    <article
                      key={doc.id}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                    >
                      <a
                        href={doc.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block aspect-square bg-gray-100 dark:bg-gray-800"
                      >
                        <img
                          src={doc.image_url}
                          alt={doc.caption || "Dokumentasi event"}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </a>

                      <div className="p-3">
                        <p className="text-xs font-bold">
                          {doc.username || "Pengunjung"}
                        </p>

                        {doc.caption && (
                          <p className="mt-1 line-clamp-3 text-xs text-gray-600 dark:text-gray-300">
                            {doc.caption}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
              </div>

              {docs.filter((doc) => doc.event_id === selectedEvent.id)
                .length === 0 && (
                <p className="mt-4 rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                  Belum ada dokumentasi yang diunggah.
                </p>
              )}
            </section>
          </main>
        )}

        {/* MODAL LOGIN USER */}
        {showLoginUser && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setShowLoginUser(false);
              }
            }}
          >
            <section className="my-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                    Selamat datang kembali
                  </p>
                  <h2 className="mt-2 text-2xl font-black">Masuk NGIPEN</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Masuk untuk menyimpan dan mengunggah event.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowLoginUser(false)}
                  className="rounded-full px-3 py-1 text-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Tutup login"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleLoginUser();
                }}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="login-user-u"
                    className="mb-1 block text-sm font-semibold"
                  >
                    Username Instagram
                  </label>
                  <input
                    id="login-user-u"
                    type="text"
                    autoComplete="username"
                    required
                    minLength={3}
                    placeholder="contoh: username_cosplay"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <label
                    htmlFor="login-user-p"
                    className="mb-1 block text-sm font-semibold"
                  >
                    Password
                  </label>
                  <input
                    id="login-user-p"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="Masukkan password"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
                >
                  Masuk
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-gray-500">
                Belum punya akun?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginUser(false);
                    setShowRegUser(true);
                  }}
                  className="font-bold text-red-600 hover:underline"
                >
                  Daftar sekarang
                </button>
              </p>
            </section>
          </div>
        )}

        {/* MODAL PENDAFTARAN */}
        {showRegUser && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setShowRegUser(false);
              }
            }}
          >
            <section className="my-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                    Bergabung dengan komunitas
                  </p>
                  <h2 className="mt-2 text-2xl font-black">Buat Akun</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRegUser(false)}
                  className="rounded-full px-3 py-1 text-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Tutup pendaftaran"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleRegUser();
                }}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="reg-user-u"
                    className="mb-1 block text-sm font-semibold"
                  >
                    Username Instagram
                  </label>
                  <input
                    id="reg-user-u"
                    type="text"
                    autoComplete="username"
                    minLength={3}
                    maxLength={30}
                    required
                    placeholder="contoh: nama_cosplayer"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Gunakan huruf kecil, angka, atau underscore.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reg-user-d"
                    className="mb-1 block text-sm font-semibold"
                  >
                    Nama tampilan
                  </label>
                  <input
                    id="reg-user-d"
                    type="text"
                    maxLength={50}
                    placeholder="Nama yang ditampilkan"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <label
                    htmlFor="reg-user-p"
                    className="mb-1 block text-sm font-semibold"
                  >
                    Password
                  </label>
                  <input
                    id="reg-user-p"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    placeholder="Minimal 8 karakter"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Gunakan kombinasi huruf dan angka.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
                >
                  Daftar Akun
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-gray-500">
                Sudah punya akun?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setShowRegUser(false);
                    setShowLoginUser(true);
                  }}
                  className="font-bold text-red-600 hover:underline"
                >
                  Masuk
                </button>
              </p>
            </section>
          </div>
        )}

        {/* MODAL LOGIN ADMIN */}
        {showAdmin && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/70 p-4">
            <section className="my-auto w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                    Akses pengelola
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    {currentRole === "admin"
                      ? "Panel Admin NGIPEN"
                      : "Login Admin"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdmin(false)}
                  className="rounded-full px-3 py-1 text-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Tutup panel admin"
                >
                  ×
                </button>
              </div>

              {currentRole !== "admin" ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleLoginAdmin();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="admin-user"
                      className="mb-1 block text-sm font-semibold"
                    >
                      Username admin
                    </label>
                    <input
                      id="admin-user"
                      type="text"
                      autoComplete="username"
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-pin"
                      className="mb-1 block text-sm font-semibold"
                    >
                      PIN admin
                    </label>
                    <input
                      id="admin-pin"
                      type="password"
                      inputMode="numeric"
                      autoComplete="current-password"
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
                  >
                    Masuk Admin
                  </button>
                </form>
              ) : (
                <>
                  <div className="flex gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
                    <button
                      onClick={() => setAdminTab("moderation")}
                      className={`rounded-xl px-3 py-2 text-sm font-bold ${
                        adminTab === "moderation"
                          ? "bg-red-600 text-white"
                          : "bg-gray-100 dark:bg-gray-800"
                      }`}
                    >
                      Moderasi Event
                    </button>

                    <button
                      onClick={() => setAdminTab("users")}
                      className={`rounded-xl px-3 py-2 text-sm font-bold ${
                        adminTab === "users"
                          ? "bg-red-600 text-white"
                          : "bg-gray-100 dark:bg-gray-800"
                      }`}
                    >
                      Pengguna
                    </button>
                  </div>

                  {adminTab === "moderation" ? (
                    <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto">
                      {events.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-500">
                          Belum ada event yang dikirim.
                        </p>
                      ) : (
                        events.map((event) => (
                          <article
                            key={event.id}
                            className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                          >
                            <div className="flex gap-3">
                              {event.poster_url && (
                                <img
                                  src={event.poster_url}
                                  alt=""
                                  className="h-24 w-16 shrink-0 rounded-lg object-cover"
                                />
                              )}

                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold">{event.title}</h3>
                                <p className="mt-1 text-xs text-gray-500">
                                  {event.organizer_name} · {event.city}
                                </p>
                                <p className="mt-1 text-xs">
                                  Status:{" "}
                                  <span className="font-bold">
                                    {event.moderation_status}
                                  </span>
                                </p>
                                <p className="mt-1 text-xs">
                                  {event.is_sponsored
                                    ? "★ Promote aktif"
                                    : "Belum dipromosikan"}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() =>
                                  void handleModeration(event.id, "Approved")
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white"
                              >
                                Setujui
                              </button>

                              <button
                                onClick={() =>
                                  void handleModeration(event.id, "Rejected")
                                }
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white"
                              >
                                Tolak
                              </button>

                              <button
                                onClick={() =>
                                  void handleModeration(event.id, "Hidden")
                                }
                                className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-bold text-gray-800 dark:bg-gray-700 dark:text-white"
                              >
                                Sembunyikan
                              </button>

                              <button
                                onClick={() =>
                                  void handleModeration(
                                    event.id,
                                    "Approved",
                                    !event.is_sponsored,
                                    event.is_sponsored ? 0 : 1
                                  )
                                }
                                className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-gray-950"
                              >
                                {event.is_sponsored
                                  ? "Hapus Promote"
                                  : "Jadikan Promote"}
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 max-h-[55vh] overflow-y-auto">
                      {usersLoadError && (
                        <p className="mb-3 rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
                          Data pengguna tidak dapat dimuat: {usersLoadError}
                        </p>
                      )}

                      {registeredUsers.length === 0 ? (
                        <p className="py-8 text-center text-sm text-gray-500">
                          Belum ada data pengguna.
                        </p>
                      ) : (
                        registeredUsers.map((user) => (
                          <div
                            key={user.id}
                            className="flex items-center gap-3 border-b border-gray-100 py-3 dark:border-gray-800"
                          >
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-bold text-red-700">
                                {(user.display_name || user.username)[0].toUpperCase()}
                              </div>
                            )}

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">
                                {user.display_name || user.username}
                              </p>
                              <p className="truncate text-xs text-gray-500">
                                @{user.username}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}

        {/* MODAL PROFIL USER */}
        {showUserProfile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4">
            <section className="my-auto w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                    Pengaturan akun
                  </p>
                  <h2 className="mt-2 text-2xl font-black">Profil Saya</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setShowUserProfile(false)}
                  className="rounded-full px-3 py-1 text-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Tutup profil"
                >
                  ×
                </button>
              </div>

              {currentRole === "user" ? (
                <>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleUpdateUserProfile();
                    }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-4">
                      {userAvatarFile ? (
                        <img
                          src={URL.createObjectURL(userAvatarFile)}
                          alt="Pratinjau avatar"
                          className="h-20 w-20 rounded-full object-cover"
                        />
                      ) : registeredUsers.find(
                          (user) => user.id === currentUserId
                        )?.avatar_url ? (
                        <img
                          src={
                            registeredUsers.find(
                              (user) => user.id === currentUserId
                            )!.avatar_url
                          }
                          alt="Avatar"
                          className="h-20 w-20 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-2xl font-black text-red-700">
                          {(currentUser || "U")[0].toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="font-bold">{currentUser}</p>
                        <p className="text-xs text-gray-500">
                          @{registeredUsers.find(
                            (user) => user.id === currentUserId
                          )?.username || currentUser}
                        </p>

                        <label className="mt-2 inline-flex cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700">
                          Pilih Foto Profil
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (!file) return;

                              if (!file.type.startsWith("image/")) {
                                setToast("File harus berupa gambar.");
                                return;
                              }

                              if (file.size > 3 * 1024 * 1024) {
                                setToast("Ukuran foto maksimal 3 MB.");
                                return;
                              }

                              const url = URL.createObjectURL(file);
                              setAvatarToCrop(url);
                              setAvatarZoom(1);
                              setAvatarPos({ x: 0, y: 0 });
                              setShowAvatarCrop(true);
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="edit-user-display"
                        className="mb-1 block text-sm font-semibold"
                      >
                        Nama tampilan
                      </label>
                      <input
                        id="edit-user-display"
                        defaultValue={currentUser}
                        required
                        maxLength={50}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="edit-user-bio"
                        className="mb-1 block text-sm font-semibold"
                      >
                        Bio
                      </label>
                      <textarea
                        id="edit-user-bio"
                        defaultValue={
                          registeredUsers.find(
                            (user) => user.id === currentUserId
                          )?.bio || ""
                        }
                        rows={3}
                        maxLength={300}
                        placeholder="Ceritakan sedikit tentang dirimu..."
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700"
                    >
                      Simpan Profil
                    </button>
                  </form>

                  <div className="my-6 border-t border-gray-200 dark:border-gray-800" />

                  <h3 className="font-bold">Ganti Password</h3>

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleChangeUserPassword();
                    }}
                    className="mt-3 space-y-3"
                  >
                    <input
                      id="edit-user-oldpass"
                      type="password"
                      autoComplete="current-password"
                      required
                      placeholder="Password lama"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                    />

                    <input
                      id="edit-user-newpass"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      placeholder="Password baru (minimal 8 karakter)"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                    />

                    <button
                      type="submit"
                      className="w-full rounded-xl border border-gray-300 px-5 py-3 font-bold dark:border-gray-700"
                    >
                      Ganti Password
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  Profil ini hanya tersedia untuk akun user.
                </p>
              )}
            </section>
          </div>
        )}

        {/* MODAL UPLOAD / EDIT EVENT */}
        {eventFormOpen && currentRole === "user" && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-5">
            <section className="my-auto max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                    Publikasikan kegiatan
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    {editingEvent ? "Edit Event" : "Upload Poster Event"}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Event akan ditinjau admin sebelum tampil di halaman publik.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEventFormOpen(false);
                    setEditingEvent(null);
                    setPosterFile(null);
                    setPosterPreview("");
                    setPosterError("");
                  }}
                  className="rounded-full px-3 py-1 text-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Tutup formulir"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateEvent();
                }}
                className="space-y-5"
              >
                {/* POSTER */}
                <div>
                  <label
                    htmlFor="new-poster"
                    className="mb-2 block text-sm font-bold"
                  >
                    Poster event <span className="text-red-600">*</span>
                  </label>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
                    <div className="flex aspect-[3/4] max-h-[300px] items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-950">
                      {posterPreview ? (
                        <img
                          src={posterPreview}
                          alt="Pratinjau poster"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="px-4 text-center text-sm text-gray-500">
                          <span className="block text-3xl">🖼️</span>
                          <span className="mt-2 block">Pratinjau poster</span>
                          <span className="mt-1 block text-xs">
                            Rasio 3:4
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col justify-center">
                      <input
                        id="new-poster"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        required={!editingEvent}
                        onChange={(event) => {
                          const file = event.target.files?.[0];

                          if (file) {
                            handlePosterUpload(file, setPosterPreview);
                          }
                        }}
                        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-4 file:py-2 file:font-bold file:text-red-700 dark:file:bg-red-950 dark:file:text-red-300"
                      />

                      <p className="mt-2 text-xs leading-5 text-gray-500">
                        Format JPG, PNG, atau WebP. Maksimal 3 MB. Rasio yang
                        disarankan adalah 3:4.
                      </p>

                      {posterError && (
                        <p className="mt-2 text-sm font-semibold text-red-600">
                          {posterError}
                        </p>
                      )}

                      {posterPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setPosterFile(null);
                            setPosterPreview("");
                            setPosterError("");

                            const input = document.getElementById(
                              "new-poster"
                            ) as HTMLInputElement | null;

                            if (input) input.value = "";
                          }}
                          className="mt-3 self-start text-xs font-bold text-red-600 hover:underline"
                        >
                          Hapus poster pilihan
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* DETAIL DASAR */}
                <div>
                  <label
                    htmlFor="new-title"
                    className="mb-1 block text-sm font-bold"
                  >
                    Nama event *
                  </label>
                  <input
                    id="new-title"
                    defaultValue={editingEvent?.title || ""}
                    required
                    minLength={3}
                    maxLength={150}
                    placeholder="Contoh: Anime Festival Indonesia"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-desc"
                    className="mb-1 block text-sm font-bold"
                  >
                    Deskripsi event *
                  </label>
                  <textarea
                    id="new-desc"
                    defaultValue={editingEvent?.description || ""}
                    required
                    minLength={20}
                    maxLength={5000}
                    rows={5}
                    placeholder="Jelaskan acara, kegiatan, dan informasi penting..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <p className="mb-2 text-sm font-bold">Kategori event *</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {eventCategoryOptions.map((category) => (
                      <label
                        key={category}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${
                          newCategories.includes(category)
                            ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={newCategories.includes(category)}
                          onChange={(event) => {
                            setNewCategories((prev) =>
                              event.target.checked
                                ? [...prev, category]
                                : prev.filter((item) => item !== category)
                            );
                          }}
                          className="accent-red-600"
                        />
                        {category}
                      </label>
                    ))}
                  </div>
                </div>

                {/* LOKASI */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="new-prov"
                      className="mb-1 block text-sm font-bold"
                    >
                      Provinsi *
                    </label>
                    <select
                      id="new-prov"
                      defaultValue={editingEvent?.province || "DKI Jakarta"}
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-950"
                    >
                      {ALL_PROVINCES.map((province) => (
                        <option key={province} value={province}>
                          {province}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="new-city"
                      className="mb-1 block text-sm font-bold"
                    >
                      Kota / Kabupaten *
                    </label>
                    <input
                      id="new-city"
                      defaultValue={editingEvent?.city || ""}
                      required
                      maxLength={100}
                      placeholder="Contoh: Jakarta Selatan"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="new-venue"
                    className="mb-1 block text-sm font-bold"
                  >
                    Alamat / tempat acara *
                  </label>
                  <input
                    id="new-venue"
                    defaultValue={editingEvent?.venue_address || ""}
                    required
                    maxLength={300}
                    placeholder="Nama gedung, alamat, atau lokasi acara"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>

                {/* TANGGAL DAN WAKTU */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="new-start"
                      className="mb-1 block text-sm font-bold"
                    >
                      Tanggal mulai *
                    </label>
                    <input
                      id="new-start"
                      type="date"
                      defaultValue={editingEvent?.start_date || ""}
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="new-end"
                      className="mb-1 block text-sm font-bold"
                    >
                      Tanggal selesai *
                    </label>
                    <input
                      id="new-end"
                      type="date"
                      defaultValue={editingEvent?.end_date || ""}
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="new-start-time"
                      className="mb-1 block text-sm font-bold"
                    >
                      Jam mulai
                    </label>
                    <input
                      id="new-start-time"
                      type="time"
                      defaultValue={editingEvent?.start_time || "09:00"}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="new-end-time"
                      className="mb-1 block text-sm font-bold"
                    >
                      Jam selesai
                    </label>
                    <input
                      id="new-end-time"
                      type="time"
                      defaultValue={editingEvent?.end_time || "18:00"}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </div>
                </div>

                {/* TIKET */}
                <div>
                  <p className="mb-2 text-sm font-bold">Jenis tiket *</p>
                  <div className="grid grid-cols-2 gap-3">
                    {(["Gratis", "Berbayar"] as TicketType[]).map((ticket) => (
                      <label
                        key={ticket}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 ${
                          newTicketType === ticket
                            ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : "border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <input
                          type="radio"
                          name="event-ticket-type"
                          checked={newTicketType === ticket}
                          onChange={() => setNewTicketType(ticket)}
                          className="accent-red-600"
                        />
                        <span className="text-sm font-bold">{ticket}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {newTicketType === "Berbayar" && (
                  <div>
                    <label
                      htmlFor="new-ticket-url"
                      className="mb-1 block text-sm font-bold"
                    >
                      Link pembelian tiket *
                    </label>
                    <input
                      id="new-ticket-url"
                      type="url"
                      defaultValue={editingEvent?.ticket_url || ""}
                      required
                      placeholder="https://..."
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="new-lomba-url"
                    className="mb-1 block text-sm font-bold"
                  >
                    Link pendaftaran / informasi (opsional)
                  </label>
                  <input
                    id="new-lomba-url"
                    type="url"
                    defaultValue={editingEvent?.registration_url || ""}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>

                <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                  Setelah dikirim, event berstatus Pending dan tidak langsung
                  tampil di halaman publik. Admin perlu menyetujuinya terlebih
                  dahulu. Promosi event hanya dapat diatur melalui panel admin.
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEventFormOpen(false);
                      setEditingEvent(null);
                      setPosterFile(null);
                      setPosterPreview("");
                      setPosterError("");
                    }}
                    className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold dark:border-gray-700"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
                  >
                    {editingEvent ? "Simpan Perubahan" : "Kirim Event"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* MODAL CROP AVATAR */}
        {showAvatarCrop && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
            <section className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:p-7">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-black">Atur Foto Profil</h2>
                <button
                  type="button"
                  onClick={() => setShowAvatarCrop(false)}
                  className="rounded-full px-3 py-1 text-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Tutup crop avatar"
                >
                  ×
                </button>
              </div>

              <div className="mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-full border-4 border-red-500 bg-gray-100 dark:bg-gray-800">
                <img
                  ref={avatarImgRef}
                  src={avatarToCrop}
                  alt="Foto yang akan dipotong"
                  className="h-full w-full object-cover"
                  style={{
                    transform: `scale(${avatarZoom}) translate(${avatarPos.x}px, ${avatarPos.y}px)`,
                  }}
                />
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-bold">
                  Zoom foto
                </label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={avatarZoom}
                  onChange={(event) => setAvatarZoom(Number(event.target.value))}
                  className="w-full accent-red-600"
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold">
                    Geser horizontal
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={avatarPos.x}
                    onChange={(event) =>
                      setAvatarPos((prev) => ({
                        ...prev,
                        x: Number(event.target.value),
                      }))
                    }
                    className="w-full accent-red-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold">
                    Geser vertikal
                  </label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={avatarPos.y}
                    onChange={(event) =>
                      setAvatarPos((prev) => ({
                        ...prev,
                        y: Number(event.target.value),
                      }))
                    }
                    className="w-full accent-red-600"
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAvatarCrop(false)}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold dark:border-gray-700"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleAvatarCropSave}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700"
                >
                  Gunakan Foto
                </button>
              </div>
            </section>
          </div>
        )}

        {/* NOTIFIKASI / TOAST */}
        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 left-4 right-4 z-[200] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-gray-950 px-5 py-4 text-sm font-semibold text-white shadow-2xl sm:left-auto sm:right-6"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600">
              !
            </span>
            <p className="min-w-0 flex-1 break-words">{toast}</p>
            <button
              type="button"
              onClick={() => setToast("")}
              className="rounded-lg px-2 py-1 text-lg text-gray-300 hover:bg-white/10"
              aria-label="Tutup notifikasi"
            >
              ×
            </button>
          </div>
        )}

        {/* FOOTER */}
        {!selectedEvent && (
          <footer className="border-t border-gray-200 bg-white px-4 py-8 dark:border-gray-800 dark:bg-gray-950 sm:px-6">
            <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="NGIPEN"
                  className="h-10 w-10 rounded-xl object-contain"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
                <div>
                  <p className="font-black tracking-wide">NGIPEN</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Satu hobby satu keseruan.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500 dark:text-gray-400">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEvent(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="hover:text-red-600"
                >
                  Beranda
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentRole !== "user") {
                      setToast("Silakan login sebagai user terlebih dahulu.");
                      setShowLoginUser(true);
                      return;
                    }

                    setEditingEvent(null);
                    setPosterFile(null);
                    setPosterPreview("");
                    setPosterError("");
                    setNewCategories([]);
                    setNewTicketType("Gratis");
                    setEventFormOpen(true);
                  }}
                  className="hover:text-red-600"
                >
                  Publikasikan Event
                </button>

                <button
                  type="button"
                  onClick={toggleTheme}
                  className="hover:text-red-600"
                >
                  {dark ? "Mode Terang" : "Mode Gelap"}
                </button>
              </div>

              <p className="text-xs text-gray-400">
                © {new Date().getFullYear()} NGIPEN
              </p>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
