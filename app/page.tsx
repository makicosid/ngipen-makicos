
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";

type TicketType = "Gratis" | "Berbayar";
type Category =
  | "Gratis"
  | "Berbayar"
  | "Cosplay"
  | "Performance"
  | "Pefomance"
  | "Market"
  | "Game"
  | "Comic"
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
  social_link?: string;
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

interface CostumeRental {
  id: string;
  name: string;
  region: string;
  province: string | null;
  city: string | null;
  instagram_url: string;
  image_url: string;
  image_path: string;
  display_order: number;
  created_at: string;
  is_verified: boolean;
  is_subscription: boolean;
  whatsapp_number: string | null;
  subscription_expires_at: string | null;
  total_views: number;
  is_subscription_active: boolean;
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
  "Pefomance",
  "Market",
  "Game",
  "Comic",
];


function getTimeStatus(event: Event): TimeStatus {
  const now = new Date();

  const startTime = event.start_time || "00:00:00";
  const endTime = event.end_time || "23:59:59";

  const start = new Date(`${event.start_date}T${startTime}+07:00`);
  const end = new Date(`${event.end_date}T${endTime}+07:00`);

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


function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function Page() {
    const formatEventDate = (startDate: string, endDate?: string) => {
    const formatDate = (dateString: string) => {
      const date = new Date(dateString + "T00:00:00");

      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    if (!endDate || startDate === endDate) {
      return formatDate(startDate);
    }

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");

    if (
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear()
    ) {
      return `${start.getDate()}–${end.getDate()} ${end.toLocaleDateString(
        "id-ID",
        { month: "long", year: "numeric" }
      )}`;
    }

    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  };
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentEventPage, setCurrentEventPage] = useState(1);
  const [eventsPerPage, setEventsPerPage] = useState(8);
  const [showThisWeekOnly, setShowThisWeekOnly] = useState(false);
  const [realTimeTick, setRealTimeTick] = useState(0);

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
const [showCalendar, setShowCalendar] = useState(false);
  const [isMobileCalendar, setIsMobileCalendar] = useState(false);

useEffect(() => {
  const checkScreenSize = () => {
    setIsMobileCalendar(window.innerWidth < 640);
  };

  checkScreenSize();
  window.addEventListener("resize", checkScreenSize);

  return () => window.removeEventListener("resize", checkScreenSize);
}, []);
const [calendarMonth, setCalendarMonth] = useState(new Date());
const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
const [eventStatusTab, setEventStatusTab] = useState<
  "Semua" | "Upcoming" | "Ongoing" | "Completed"
>("Semua");

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
const eventOpenSourceRef = useRef<"calendar" | "explore" | "other">("explore");
const calendarScrollYRef = useRef(0);
const [activeEventPreview, setActiveEventPreview] = useState<Event | null>(null);
const [eventPreviewClosing, setEventPreviewClosing] = useState(false);
const eventPreviewTimerRef = useRef<number | null>(null);
const eventPreviewCloseTimerRef = useRef<number | null>(null);
const eventPreviewStartRef = useRef<{ x: number; y: number } | null>(null);
const eventPreviewShownRef = useRef(false);
const suppressNextEventClickRef = useRef(false);
  const [pendingGuestEvent, setPendingGuestEvent] = useState<Event | null>(null);
const [descriptionExpanded, setDescriptionExpanded] = useState(false);

useEffect(() => {
  setDescriptionExpanded(false);
}, [selectedEvent?.id]);

const sharedEventOpenedRef = useRef<string | null>(null);

const sponsorCarouselRef = useRef<HTMLDivElement>(null);
const sponsorCarouselPausedRef = useRef(false);
  // Setiap kali detail event dibuka, mulai dari bagian paling atas halaman.
  useEffect(() => {
    if (!selectedEvent) return;

    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedEvent?.id]);

  const [showLoginUser, setShowLoginUser] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegUser, setShowRegUser] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);

  const [currentRole, setCurrentRole] = useState<Role>("guest");
  const [sessionReady, setSessionReady] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [toast, setToast] = useState("");
  const [logoClicks, setLogoClicks] = useState(0);

  const [registeredUsers, setRegisteredUsers] = useState<RegUser[]>([]);
  const [usersLoadError, setUsersLoadError] = useState("");

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [docs, setDocs] = useState<Doc[]>([]);

  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [posterPreview, setPosterPreview] = useState("");
  const [posterError, setPosterError] = useState("");
  const [posterFile, setPosterFile] = useState<File | null>(null);

  const [newCategories, setNewCategories] = useState<Category[]>(["Cosplay"]);
  const [newTicketType, setNewTicketType] = useState<TicketType>("Gratis");

 const [adminTab, setAdminTab] =
    useState<"moderation" | "users" | "rentals">("moderation");
  const [adminEventTab, setAdminEventTab] = useState<
    "Pending" | "Approved" | "Rejected" | "Sponsored" | "Completed" | "Hidden"
  >("Pending");
// Data Cari Costume
const [showCostumeDirectory, setShowCostumeDirectory] = useState(false);
const [rentals, setRentals] = useState<CostumeRental[]>([]);
const [rentalLoading, setRentalLoading] = useState(true);

// Form rental admin
const [rentalName, setRentalName] = useState("");
const [rentalRegion, setRentalRegion] = useState("");
const [rentalProvince, setRentalProvince] = useState("");
const [rentalCity, setRentalCity] = useState("");
const [rentalInstagram, setRentalInstagram] = useState("");
const [rentalFilterProvince, setRentalFilterProvince] = useState("Semua");
const [rentalFilterCity, setRentalFilterCity] = useState("Semua");
const [verifiedRentalPage, setVerifiedRentalPage] = useState(1);
const [freeRentalPage, setFreeRentalPage] = useState(1);
const [rentalWhatsapp, setRentalWhatsapp] = useState("");
const [rentalSubscriptionExpiry, setRentalSubscriptionExpiry] = useState("");
const [rentalFile, setRentalFile] = useState<File | null>(null);
const [rentalPreview, setRentalPreview] = useState("");
const [editingRentalId, setEditingRentalId] = useState<string | null>(null);
const [rentalFormHighlight, setRentalFormHighlight] = useState(false);
const [rentalSaving, setRentalSaving] = useState(false);
  const refreshRentals = async () => {
  try {
    const response = await fetch("/api/admin-rentals", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Gagal mengambil data rental.");
    }

    const data = await response.json();
    setRentals(Array.isArray(data.rentals) ? data.rentals : []);
  } catch (error) {
    console.error("Gagal memuat rental:", error);
    setRentals([]);
  } finally {
    setRentalLoading(false);
  }
};
useEffect(() => {
  refreshRentals();
}, []);
  const resetRentalForm = () => {
  setRentalName("");
  setRentalRegion("");
  setRentalProvince("");
  setRentalCity("");
  setRentalInstagram("");
  setRentalWhatsapp("");
  setRentalSubscriptionExpiry("");
  setRentalFile(null);
  setRentalPreview("");
  setEditingRentalId(null);
};
const handleSaveRental = async () => {
  if (
    !rentalName.trim() ||
    !rentalProvince.trim() ||
    !rentalCity.trim() ||
    !rentalInstagram.trim()
  ) {
    setToast("Nama, Provinsi, Kota/Kabupaten, dan Instagram wajib diisi.");
    return;
  }

  if (!editingRentalId && !rentalFile) {
    setToast("Foto rental wajib diunggah.");
    return;
  }

  setRentalSaving(true);

  try {
    const formData = new FormData();

if (editingRentalId) {
  formData.append("id", editingRentalId);
}

formData.append("name", rentalName.trim());
// Kolom region tetap dikirim untuk kompatibilitas database lama,
// tetapi tidak lagi ditampilkan sebagai input Domisili di form Admin.
const regionValue =
  rentalRegion.trim() || `${rentalProvince.trim()}, ${rentalCity.trim()}`;
formData.append("region", regionValue);
formData.append("province", rentalProvince.trim());
formData.append("city", rentalCity.trim());
formData.append("instagram_url", rentalInstagram.trim());
formData.append("whatsapp_number", rentalWhatsapp.trim());
if (rentalSubscriptionExpiry) {
  formData.append("subscription_expires_at", rentalSubscriptionExpiry);
}

    if (rentalFile) {
      formData.append("image", rentalFile);
    }

    const response = await fetch("/api/admin-rentals", {
      method: editingRentalId ? "PATCH" : "POST",
      credentials: "include",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Gagal menyimpan rental.");
    }

    await refreshRentals();
    resetRentalForm();
    setToast("Data rental berhasil disimpan.");
  } catch (error) {
    setToast(
      error instanceof Error ? error.message : "Terjadi kesalahan."
    );
  } finally {
    setRentalSaving(false);
  }
};
  
  const handleEditRental = (rental: CostumeRental) => {
  setRentalName(rental.name);
  setRentalRegion(rental.region);
  setRentalProvince(rental.province || "");
  setRentalCity(rental.city || "");
  setRentalInstagram(rental.instagram_url);
  setRentalWhatsapp(rental.whatsapp_number || "");
  setRentalSubscriptionExpiry(
    rental.subscription_expires_at
      ? new Date(rental.subscription_expires_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
      : ""
  );
  setRentalFile(null);
  setRentalPreview(rental.image_url);
  setEditingRentalId(rental.id);
  setRentalFormHighlight(true);

  window.setTimeout(() => {
    const form = document.getElementById("admin-rental-form");
    form?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 80);

  window.setTimeout(() => setRentalFormHighlight(false), 1800);
};
  const handleToggleRentalStatus = async (
  rental: CostumeRental,
  statusField: "is_verified" | "is_subscription"
) => {
  const nextValue = !rental[statusField];

  try {
    const formData = new FormData();

    formData.append("id", rental.id);
    formData.append("name", rental.name);
    formData.append("region", rental.region);
    formData.append("province", rental.province || "");
    formData.append("city", rental.city || "");
    formData.append("instagram_url", rental.instagram_url);
    if (rental.whatsapp_number) {
      formData.append("whatsapp_number", rental.whatsapp_number);
    }
    if (statusField === "is_subscription" && nextValue) {
      const expiryDate = (editingRentalId === rental.id && rentalSubscriptionExpiry)
        ? rentalSubscriptionExpiry
        : (rental.subscription_expires_at
            ? new Date(rental.subscription_expires_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" })
            : "");
      if (!expiryDate) {
        setToast("Edit rental terlebih dahulu dan isi tanggal akhir Subscription.");
        return;
      }
      formData.append("subscription_expires_at", expiryDate);
    } else if (rental.subscription_expires_at) {
      formData.append("subscription_expires_at", new Date(rental.subscription_expires_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" }));
    }
    formData.append(statusField, String(nextValue));

    const response = await fetch("/api/admin-rentals", {
      method: "PATCH",
      credentials: "include",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Gagal mengubah status rental.");
    }

    await refreshRentals();

    setToast(
      statusField === "is_verified"
        ? nextValue
          ? "Partner Ship berhasil diaktifkan."
          : "Partner Ship berhasil dinonaktifkan."
        : nextValue
          ? "Subscription berhasil diaktifkan."
          : "Subscription berhasil dinonaktifkan."
    );
  } catch (error) {
    setToast(
      error instanceof Error ? error.message : "Terjadi kesalahan."
    );
  }
};
  
  const trackRentalClick = (rentalId: string, channel: "instagram" | "whatsapp") => {
    void fetch("/api/rental-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rental_id: rentalId, channel }),
      keepalive: true,
    }).then(() => refreshRentals()).catch((error) => {
      console.error("Gagal mencatat klik rental:", error);
    });
  };

  const openRentalInstagram = (rental: CostumeRental) => {
    window.open(rental.instagram_url, "_blank", "noopener,noreferrer");
    trackRentalClick(rental.id, "instagram");
  };

  const openRentalWhatsapp = (rental: CostumeRental) => {
    const number = (rental.whatsapp_number || "").replace(/\D/g, "");
    if (!number) return;
    window.open(`https://wa.me/${number}`, "_blank", "noopener,noreferrer");
    trackRentalClick(rental.id, "whatsapp");
  };

  const handleDeleteRental = async (rental: CostumeRental) => {
  const confirmed = window.confirm(
    `Yakin ingin menghapus rental "${rental.name}"?`
  );

  if (!confirmed) return;

  try {
    const response = await fetch("/api/admin-rentals", {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: rental.id }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Gagal menghapus rental.");
    }

    await refreshRentals();

    if (editingRentalId === rental.id) {
      resetRentalForm();
    }

    setToast("Rental berhasil dihapus.");
  } catch (error) {
    setToast(
      error instanceof Error ? error.message : "Terjadi kesalahan."
    );
  }
};
const handleRentalImage = (file: File | null) => {
  if (!file) return;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.type)) {
    setToast("Format foto harus JPG, PNG, atau WEBP.");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setToast("Ukuran foto maksimal 5 MB.");
    return;
  }

  const image = new Image();
  const previewUrl = URL.createObjectURL(file);

  image.onload = () => {
    if (image.width !== image.height) {
      URL.revokeObjectURL(previewUrl);
      setToast("Foto rental harus berbentuk persegi (1:1).");
      return;
    }

    setRentalFile(file);
    setRentalPreview(previewUrl);
  };

  image.onerror = () => {
    URL.revokeObjectURL(previewUrl);
    setToast("Foto tidak dapat dibaca.");
  };

  image.src = previewUrl;
};
  
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
  }, []);

  // Pulihkan sesi login user melalui verifikasi cookie server
  useEffect(() => {
  let active = true;

 const restoreSession = async () => {
  try {
    // Periksa sesi admin terlebih dahulu
    const adminResponse = await fetch("/api/admin-auth", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const adminResult = await adminResponse.json();

    if (!active) return;

    if (adminResponse.ok && adminResult.authenticated) {
      localStorage.setItem("ngipen_role", "admin");
      localStorage.removeItem("ngipen_user");
      localStorage.removeItem("ngipen_username");
      localStorage.removeItem("ngipen_user_id");

      setCurrentRole("admin");
      setCurrentUser("");
      setCurrentUserId("");
      return;
    }

    // Jika bukan admin, periksa sesi user
    const response = await fetch("/api/auth", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const result = await response.json();

    if (!active) return;

    if (response.ok && result.user) {
      const user = result.user;

      localStorage.setItem("ngipen_role", "user");
      localStorage.setItem(
        "ngipen_user",
        user.display_name || user.username
      );
      localStorage.setItem("ngipen_username", user.username);
      localStorage.setItem("ngipen_user_id", String(user.id));

      setCurrentRole("user");
      setCurrentUser(user.display_name || user.username);
      setCurrentUserId(user.id);
    } else {
      localStorage.removeItem("ngipen_role");
      localStorage.removeItem("ngipen_user");
      localStorage.removeItem("ngipen_username");
      localStorage.removeItem("ngipen_user_id");

      setCurrentRole("guest");
      setCurrentUser("");
      setCurrentUserId("");
    }
  } catch (error) {
    console.error("Gagal memulihkan sesi:", error);
  } finally {
    if (active) setSessionReady(true);
  }
};

  restoreSession();

  return () => {
    active = false;
  };
}, []);

  // Perbarui acuan tanggal secara berkala agar filter Minggu Ini tetap akurat.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setRealTimeTick((value) => value + 1);
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);
// Auto-slide carousel sponsor setiap 15 detik.

  // Jumlah event per halaman mengikuti ukuran layar: HP = 8, desktop = 12.
  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px)");

    const updateEventsPerPage = () => {
      setEventsPerPage(desktopQuery.matches ? 12 : 8);
      setCurrentEventPage(1);
    };

    updateEventsPerPage();
    desktopQuery.addEventListener("change", updateEventsPerPage);

    return () => {
      desktopQuery.removeEventListener("change", updateEventsPerPage);
    };
  }, []);

  // Kembali ke halaman pertama ketika pencarian, filter, atau urutan berubah.
  useEffect(() => {
    setCurrentEventPage(1);
  }, [
    search,
    selectedProv,
    selectedCity,
    selectedCat,
    selectedTicket,
    sortMode,
    userTab,
    eventStatusTab,
    showThisWeekOnly,
  ]);

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

        const sessionResponse = await fetch("/api/auth", {
  method: "GET",
  credentials: "include",
  cache: "no-store",
});

const sessionResult = await sessionResponse.json();

const savedUserId =
  sessionResponse.ok && sessionResult.user
    ? String(sessionResult.user.id)
    : null;

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
            (usersData || []).map((user: any) => [String(user.id), user])
          );

          setReviews(
            allReviews.map((review: any) => {
              const user: any = userMap.get(String(review.user_id));

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

  
// Validasi poster: maksimal 3 MB, rasio 3:4, 1:1, 4:5, atau 9:16
const handlePosterUpload = (
  file: File,
  setter: (value: string) => void
) => {
  setPosterError("");
  setPosterFile(null);
  setter("");

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
    const ratio = img.width / img.height;

    const allowedRatios = [
      3 / 4,
      1 / 1,
      4 / 5,
      9 / 16,
    ];

    const isValidRatio = allowedRatios.some(
      (allowedRatio) =>
        Math.abs(ratio - allowedRatio) <= 0.02
    );

    if (!isValidRatio) {
      setPosterError(
        "Rasio poster harus 3:4, 1:1, 4:5, atau 9:16."
      );
      setPosterFile(null);
      URL.revokeObjectURL(objectUrl);
      return;
    }

    setPosterFile(file);
    setter(objectUrl);
  };

  img.onerror = () => {
    setPosterError("Gambar tidak dapat dibaca.");
    setPosterFile(null);
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

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "login", username, password }),
      });

      const result = await response.json();

      if (!response.ok || !result.user) {
        setToast(result.error || "Username atau password salah.");
        setTimeout(() => setToast(""), 2000);
        return;
      }

      const user = result.user;

      localStorage.setItem("ngipen_role", "user");
      localStorage.setItem("ngipen_user", user.display_name || user.username);
      localStorage.setItem("ngipen_username", user.username);
      localStorage.setItem("ngipen_user_id", String(user.id));

      setCurrentRole("user");
      setCurrentUser(user.display_name || user.username);
      setCurrentUserId(user.id);

      const { data: saves } = await supabase
        .from("event_saves")
        .select("*")
        .eq("user_id", user.id);

      if (saves) setSavedIds(saves.map((save: any) => save.event_id));

      setShowLoginUser(false);
      setToast(`Halo, ${user.display_name || user.username}!`);
      setTimeout(() => setToast(""), 2000);
    } catch (error) {
      console.error("Login error:", error);
      setToast("Gagal menghubungi server. Coba lagi.");
    }
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

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "register",
          username,
          displayName: displayName || username,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setToast(result.error || "Pendaftaran gagal.");
        setTimeout(() => setToast(""), 2500);
        return;
      }

      setShowRegUser(false);
      setToast("Pendaftaran berhasil. Silakan masuk.");
      setTimeout(() => setToast(""), 2500);
    } catch (error) {
      console.error("Registration error:", error);
      setToast("Gagal menghubungi server. Coba lagi.");
    }
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

  try {
    const response = await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        action: "login",
        username,
        pin,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.authenticated) {
      setToast(result.error || "Username atau PIN admin salah.");
      setTimeout(() => setToast(""), 2000);
      return;
    }

    localStorage.setItem("ngipen_role", "admin");
    setCurrentRole("admin");
    setShowAdmin(false);
    setToast("Login admin berhasil.");
    setTimeout(() => setToast(""), 2000);
  } catch (error) {
    console.error("Admin login error:", error);
    setToast("Gagal menghubungi server.");
    setTimeout(() => setToast(""), 2000);
  }
};

 // Logout
const logout = async () => {
  try {
    // Hapus sesi admin
    await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "logout" }),
    });

    // Hapus sesi user
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "logout" }),
    });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    localStorage.removeItem("ngipen_role");
    localStorage.removeItem("ngipen_user");
    localStorage.removeItem("ngipen_username");
    localStorage.removeItem("ngipen_user_id");

    setCurrentRole("guest");
    setCurrentUser("");
    setCurrentUserId("");
    setSavedIds([]);
    setMyRatings({});
    setMobileOpen(false);
    setSelectedEvent(null);
    setPendingGuestEvent(null);
    setShowCalendar(false);
    setShowCostumeDirectory(false);
    setSelectedCalendarDate("");
    setUserTab("Semua");
    setEventStatusTab("Semua");
    eventOpenSourceRef.current = "explore";
    setActiveEventPreview(null);

    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });

    setToast("Kamu telah keluar.");
    setTimeout(() => setToast(""), 2000);
  }
};
  // Membuat event baru; pengguna tidak memiliki fitur edit event
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

    const socialLink = (
      document.getElementById("new-social-link") as HTMLInputElement
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

    if (!posterFile) {
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

    const optionalUrls = [registrationUrl, socialLink].filter(Boolean) as string[];
    if (optionalUrls.some((value) => !/^https?:\/\//i.test(value))) {
      setToast("Link opsional harus diawali http:// atau https://.");
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
      const posterUrl = await uploadToBucket(posterFile!, "posters");

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
        social_link: socialLink || null,
        moderation_status: "Pending",
        is_sponsored: false,
        sponsored_priority: 0,
        views: 0,
        saves_count: 0,
        avg_rating: 0,
        rating_count: 0,
        organizer_name: currentUser,
      };

      const { data, error } = await supabase
        .from("events")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      setEvents((prev) => [data as Event, ...prev]);
      setToast("Event dikirim dan menunggu persetujuan admin.");

      setEventFormOpen(false);
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

  // Hapus event yang sudah selesai secara permanen setelah konfirmasi admin.
  const handleDeleteCompletedEvent = async (event: Event) => {
    if (getTimeStatus(event) !== "Completed") {
      setToast("Event belum selesai dan tidak dapat dihapus dari daftar ini.");
      setTimeout(() => setToast(""), 2500);
      return;
    }

    const confirmed = window.confirm(
      `Hapus event "${event.title}" secara permanen? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", event.id);

    if (error) {
      setToast(`Gagal menghapus event: ${error.message}`);
      setTimeout(() => setToast(""), 4000);
      return;
    }

    setEvents((prev) => prev.filter((item) => item.id !== event.id));
    setSavedIds((prev) => prev.filter((id) => id !== event.id));
    if (selectedEvent?.id === event.id) setSelectedEvent(null);
    setToast("Event selesai berhasil dihapus.");
    setTimeout(() => setToast(""), 2500);
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
    if (currentRole !== "user" || !currentUserId) {
      setShowLoginUser(true);
      return;
    }
    const text = commentText.trim();
    if (!text && !myRatings[selectedEvent.id]) {
      setToast("Isi komentar atau pilih rating terlebih dahulu.");
      setTimeout(() => setToast(""), 2000);
      return;
    }
    if (docFile && docFile.size > 10 * 1024 * 1024) {
      setToast("Ukuran dokumentasi maksimal 10 MB.");
      return;
    }

    try {
      const { data: existing, error: lookupError } = await supabase
        .from("event_reviews")
        .select("id,rating,comment")
        .eq("user_id", String(currentUserId))
        .eq("event_id", String(selectedEvent.id))
        .maybeSingle();
      if (lookupError) throw lookupError;

      const payload: Record<string, any> = {
        rating: myRatings[selectedEvent.id] || existing?.rating || 5,
        comment: text || existing?.comment || "",
      };
      let saveError: any = null;
      if (existing) {
        const result = await supabase.from("event_reviews").update(payload).eq("id", String(existing.id));
        saveError = result.error;
      } else {
        const result = await supabase.from("event_reviews").insert({
          user_id: String(currentUserId),
          event_id: String(selectedEvent.id),
          ...payload,
        });
        saveError = result.error;
      }
      if (saveError) throw saveError;

      if (docFile && getTimeStatus(selectedEvent) === "Completed") {
        await handleUploadDoc();
      }

      const { data: allReviews, error: refreshError } = await supabase
        .from("event_reviews")
        .select("*")
        .eq("event_id", String(selectedEvent.id))
        .order("created_at", { ascending: false });
      if (refreshError) throw refreshError;

      const userMap = new Map(registeredUsers.map((user) => [String(user.id), user]));
      const mapped = (allReviews || []).map((review: any) => {
        const user = userMap.get(String(review.user_id));
        return {
          ...review,
          username: user?.username || review.username || "user",
          display_name: user?.display_name || user?.username || review.display_name || "Pengguna",
          avatar_url: user?.avatar_url || review.avatar_url || "",
        };
      });
      setReviews((prev) => [
        ...mapped,
        ...prev.filter((review) => String(review.event_id) !== String(selectedEvent.id)),
      ]);

      if (allReviews?.length) {
        const average = allReviews.reduce((sum: number, review: any) => sum + Number(review.rating || 0), 0) / allReviews.length;
        await supabase.from("events").update({ avg_rating: average, rating_count: allReviews.length }).eq("id", String(selectedEvent.id));
        setEvents((prev) => prev.map((event) => String(event.id) === String(selectedEvent.id) ? { ...event, avg_rating: average, rating_count: allReviews.length } : event));
        setSelectedEvent((prev) => prev ? { ...prev, avg_rating: average, rating_count: allReviews.length } : null);
      }
      setCommentText("");
      setToast("Komentar dan rating berhasil disimpan.");
      setTimeout(() => setToast(""), 2000);
    } catch (error: any) {
      setToast(`Gagal menyimpan komentar: ${error.message || "Periksa kolom dan izin Supabase."}`);
      setTimeout(() => setToast(""), 4000);
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

const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

if (!allowedImageTypes.includes(docFile.type)) {
  setToast("Format foto harus JPG, PNG, atau WebP.");
  setTimeout(() => setToast(""), 2500);
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

  // Simpan perubahan profil user; gunakan username sebagai kunci stabil untuk menghindari konflik tipe id text/uuid.
  const handleUpdateUserProfile = async () => {
    const profileUser = registeredUsers.find(
      (user) => String(user.id) === String(currentUserId)
    );
    const username = profileUser?.username || localStorage.getItem("ngipen_username") || "";

    if (!username) {
      setToast("Data akun tidak ditemukan. Keluar lalu login kembali.");
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

    let avatarUrl = profileUser?.avatar_url || "";
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
      .update({ display_name: displayName, bio, avatar_url: avatarUrl })
      .eq("username", username)
      .select("id,username,display_name,bio,avatar_url,created_at")
      .maybeSingle();

    if (error) {
      setToast(`Gagal menyimpan profil: ${error.message}`);
      return;
    }
    if (!data) {
      setToast("Profil tidak berubah di database. Periksa izin UPDATE/RLS tabel users di Supabase.");
      return;
    }

    const updated = data as RegUser;
    setRegisteredUsers((prev) => {
      const exists = prev.some((user) => user.username === username);
      return exists
        ? prev.map((user) => user.username === username ? updated : user)
        : [updated, ...prev];
    });
    setReviews((prev) => prev.map((review) =>
      String(review.user_id) === String(updated.id)
        ? { ...review, username: updated.username, display_name: updated.display_name, avatar_url: updated.avatar_url || "" }
        : review
    ));
    setCurrentUser(displayName);
    setCurrentUserId(String(updated.id));
    localStorage.setItem("ngipen_user", displayName);
    localStorage.setItem("ngipen_username", updated.username);
    localStorage.setItem("ngipen_user_id", String(updated.id));
    setUserAvatarFile(null);
    setShowUserProfile(false);
    setToast("Profil berhasil diperbarui.");
    setTimeout(() => setToast(""), 2000);
  };

  // Ganti password
  
  const handleChangeUserPassword = async () => {
    const oldInput = document.getElementById(
      "edit-user-oldpass"
    ) as HTMLInputElement | null;

    const newInput = document.getElementById(
      "edit-user-newpass"
    ) as HTMLInputElement | null;

    const oldPassword = oldInput?.value || "";
    const newPassword = newInput?.value || "";

    if (!oldPassword) {
      setToast("Masukkan password lama.");
      return;
    }

    if (
      newPassword.length < 8 ||
      newPassword.length > 128 ||
      !/[a-zA-Z]/.test(newPassword) ||
      !/[0-9]/.test(newPassword)
    ) {
      setToast(
        "Password baru minimal 8 karakter dan berisi huruf serta angka."
      );
      return;
    }

    if (oldPassword === newPassword) {
      setToast("Password baru harus berbeda dari password lama.");
      return;
    }

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "change_password",
          oldPassword,
          newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setToast(
          result.error || "Gagal mengganti password."
        );
        return;
      }

      setToast("Password berhasil diganti.");

      if (oldInput) oldInput.value = "";
      if (newInput) newInput.value = "";

      setTimeout(() => setToast(""), 2000);
    } catch (error) {
      console.error("Change password request error:", error);
      setToast("Tidak dapat terhubung ke server.");
    }
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
const calendarEvents = useMemo(() => {
  if (!selectedCalendarDate) return [];

  return approvedEvents
    .filter((event) => {
      const startDate = event.start_date;
      const endDate = event.end_date || event.start_date;

      return (
        startDate <= selectedCalendarDate &&
        endDate >= selectedCalendarDate &&
        getTimeStatus(event) !== "Completed"
      );
    })
    .sort((a, b) => {
      const timeCompare = a.created_at.localeCompare(b.created_at);

      if (timeCompare !== 0) return timeCompare;

      return a.title.localeCompare(b.title, "id", {
        sensitivity: "base",
      });
    });
}, [approvedEvents, selectedCalendarDate]);
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
useEffect(() => {
  if (sponsoredEvents.length <= 1) return;

  const interval = window.setInterval(() => {
    const carousel = sponsorCarouselRef.current;

    if (
      !carousel ||
      sponsorCarouselPausedRef.current ||
      document.hidden
    ) {
      return;
    }

    const firstCard = carousel.firstElementChild as HTMLElement | null;
    if (!firstCard) return;

    const cardWidth = firstCard.getBoundingClientRect().width;
    const styles = window.getComputedStyle(carousel);
    const gap = parseFloat(styles.columnGap) || 0;
    const distance = cardWidth + gap;

    const atEnd =
      carousel.scrollLeft + carousel.clientWidth >=
      carousel.scrollWidth - 8;

    if (atEnd) {
      carousel.scrollTo({
        left: 0,
        behavior: "smooth",
      });
    } else {
      carousel.scrollBy({
        left: distance,
        behavior: "smooth",
      });
    }
 }, 8000);

  return () => window.clearInterval(interval);
}, [sponsoredEvents.length]);

  const eventFilterCounts = useMemo(() => {
  const applyCommonFilters = (eventsToCount: Event[]) => {
    let result = [...eventsToCount];

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

    return result;
  };

  const commonEvents = applyCommonFilters(approvedEvents);

  const jakartaParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());

const dateParts = Object.fromEntries(
  jakartaParts.map((part) => [part.type, part.value])
);

const year = Number(dateParts.year);
const month = Number(dateParts.month);
const day = Number(dateParts.day);

const jakartaToday = new Date(Date.UTC(year, month - 1, day));
const daysSinceMonday = (jakartaToday.getUTCDay() + 6) % 7;

const monday = new Date(jakartaToday);
monday.setUTCDate(jakartaToday.getUTCDate() - daysSinceMonday);

const friday = new Date(monday);
friday.setUTCDate(monday.getUTCDate() + 4);

const sunday = new Date(monday);
sunday.setUTCDate(monday.getUTCDate() + 6);

const toDateKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

const weekStart = toDateKey(friday);
const weekEnd = toDateKey(sunday);

const mingguIni = commonEvents.filter((event) => {
  const eventStart = event.start_date;
  const eventEnd = event.end_date || event.start_date;

  return (
    getTimeStatus(event) !== "Completed" &&
    Boolean(eventStart) &&
    /^\d{4}-\d{2}-\d{2}$/.test(eventStart) &&
    /^\d{4}-\d{2}-\d{2}$/.test(eventEnd) &&
    eventStart <= weekEnd &&
    eventEnd >= weekStart
  );
}).length;

return {
  semua: commonEvents.filter(
    (event) => getTimeStatus(event) !== "Completed"
  ).length,
  mingguIni,
  upcoming: commonEvents.filter(
    (event) => getTimeStatus(event) === "Upcoming"
  ).length,
  ongoing: commonEvents.filter(
    (event) => getTimeStatus(event) === "Ongoing"
  ).length,
  completed: commonEvents.filter(
    (event) => getTimeStatus(event) === "Completed"
  ).length,
};
}, [
  approvedEvents,
  userTab,
  savedIds,
  search,
  selectedProv,
  selectedCity,
  selectedCat,
  selectedTicket,
  realTimeTick,
]);
  const filteredEvents = useMemo(() => {
    let result = [...approvedEvents];

    // Tab Semua dan Minggu Ini hanya menampilkan event yang belum selesai.
    // Tab Selesai tetap dapat digunakan secara eksplisit.
    if (eventStatusTab === "Semua" || showThisWeekOnly) {
      result = result.filter((event) => getTimeStatus(event) !== "Completed");
    }

    if (eventStatusTab !== "Semua") {
      result = result.filter(
        (event) => getTimeStatus(event) === eventStatusTab
      );
    }

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

    if (showThisWeekOnly) {
      // Periode filter adalah Jumat-Minggu pada minggu kalender WIB.
      // Gunakan UTC hanya untuk manipulasi tanggal agar tidak terpengaruh zona waktu perangkat.
      const jakartaParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const dateParts = Object.fromEntries(
        jakartaParts.map((part) => [part.type, part.value])
      );
      const year = Number(dateParts.year);
      const month = Number(dateParts.month);
      const day = Number(dateParts.day);
      const jakartaToday = new Date(Date.UTC(year, month - 1, day));
      const daysSinceMonday = (jakartaToday.getUTCDay() + 6) % 7;
      const monday = new Date(jakartaToday);
      monday.setUTCDate(jakartaToday.getUTCDate() - daysSinceMonday);

      const friday = new Date(monday);
      friday.setUTCDate(monday.getUTCDate() + 4);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);

      const toDateKey = (date: Date) =>
        `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
      const weekStart = toDateKey(friday);
      const weekEnd = toDateKey(sunday);
      const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

      // Event ditampilkan jika rentang acaranya beririsan dengan Jumat-Minggu.
      // Jika end_date kosong, perlakukan sebagai event satu hari.
      result = result.filter((event) => {
        const eventStart = event.start_date;
        const eventEnd = event.end_date || eventStart;

        return (
          Boolean(eventStart) &&
          isDateKey(eventStart) &&
          isDateKey(eventEnd) &&
          eventStart <= weekEnd &&
          eventEnd >= weekStart
        );
      });
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
    eventStatusTab,
    userTab,
    savedIds,
    search,
    selectedProv,
    selectedCity,
    selectedCat,
    selectedTicket,
    showThisWeekOnly,
    realTimeTick,
    sortMode,
  ]);

  const adminFilteredEvents = useMemo(() => {
    return events.filter((event) => {
      const completed = getTimeStatus(event) === "Completed";

      if (adminEventTab === "Completed") return completed;
      if (completed) return false;

      switch (adminEventTab) {
        case "Pending":
          return event.moderation_status === "Pending";
        case "Approved":
          return event.moderation_status === "Approved" && !event.is_sponsored;
        case "Rejected":
          return event.moderation_status === "Rejected";
        case "Sponsored":
          return event.moderation_status === "Approved" && event.is_sponsored;
        case "Hidden":
          return event.moderation_status === "Hidden";
        default:
          return false;
      }
    });
  }, [events, adminEventTab, realTimeTick]);

  const totalEventPages = Math.max(
    1,
    Math.ceil(filteredEvents.length / eventsPerPage)
  );

  const paginatedEvents = useMemo(() => {
    const startIndex = (currentEventPage - 1) * eventsPerPage;
    return filteredEvents.slice(startIndex, startIndex + eventsPerPage);
  }, [filteredEvents, currentEventPage, eventsPerPage]);

  const visibleEventPages = useMemo(() => {
    const startPage = Math.max(1, currentEventPage - 2);
    const endPage = Math.min(totalEventPages, currentEventPage + 2);

    return Array.from(
      { length: endPage - startPage + 1 },
      (_, index) => startPage + index
    );
  }, [currentEventPage, totalEventPages]);

  useEffect(() => {
    setCurrentEventPage((page) => Math.min(page, totalEventPages));
  }, [totalEventPages]);

  const goToEventPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalEventPages);
    setCurrentEventPage(nextPage);
    document
      .getElementById("daftar-event")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

const clearEventPreviewTimer = () => {
  if (eventPreviewTimerRef.current !== null) {
    window.clearTimeout(eventPreviewTimerRef.current);
    eventPreviewTimerRef.current = null;
  }
};

const beginEventPreview = (event: Event, pointerEvent: React.PointerEvent) => {
  if (currentRole !== "user" || !pointerEvent.isPrimary || pointerEvent.button !== 0) return;
  suppressNextEventClickRef.current = false;
  clearEventPreviewTimer();
  if (eventPreviewCloseTimerRef.current !== null) {
    window.clearTimeout(eventPreviewCloseTimerRef.current);
    eventPreviewCloseTimerRef.current = null;
  }
  setEventPreviewClosing(false);
  eventPreviewStartRef.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
  eventPreviewShownRef.current = false;
  eventPreviewTimerRef.current = window.setTimeout(() => {
    setActiveEventPreview(event);
    eventPreviewShownRef.current = true;
  }, 400);
};

const moveEventPreviewPointer = (pointerEvent: React.PointerEvent) => {
  const start = eventPreviewStartRef.current;
  if (!start) return;
  const distance = Math.hypot(pointerEvent.clientX - start.x, pointerEvent.clientY - start.y);
  if (distance > 12) {
    clearEventPreviewTimer();
    if (eventPreviewShownRef.current) {
      suppressNextEventClickRef.current = true;
      setEventPreviewClosing(true);
      eventPreviewCloseTimerRef.current = window.setTimeout(() => {
        setActiveEventPreview(null);
        setEventPreviewClosing(false);
        eventPreviewCloseTimerRef.current = null;
      }, 140);
    }
    eventPreviewStartRef.current = null;
    eventPreviewShownRef.current = false;
  }
};

const endEventPreview = () => {
  clearEventPreviewTimer();
  if (eventPreviewShownRef.current) {
    suppressNextEventClickRef.current = true;
    setEventPreviewClosing(true);
    if (eventPreviewCloseTimerRef.current !== null) {
      window.clearTimeout(eventPreviewCloseTimerRef.current);
    }
    eventPreviewCloseTimerRef.current = window.setTimeout(() => {
      setActiveEventPreview(null);
      setEventPreviewClosing(false);
      eventPreviewCloseTimerRef.current = null;
    }, 140);
  }
  eventPreviewStartRef.current = null;
  eventPreviewShownRef.current = false;
};

const handleEventCardClick = (event: Event) => {
  if (suppressNextEventClickRef.current) {
    suppressNextEventClickRef.current = false;
    return;
  }
  void openEvent(event);
};

const openEvent = async (event: Event) => {
  eventOpenSourceRef.current = "explore";
  setActiveEventPreview(null);
  if (currentRole === "guest") {
    setPendingGuestEvent(event);
    setShowLoginUser(true);
    return;
  }

  setSelectedEvent(event);
  setCommentText("");

  // Catat view hanya untuk pengguna yang sudah login.
  if (currentRole === "user" && currentUserId) {
    try {
      const response = await fetch("/api/events/view", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId: event.id,
        }),
      });

      const result = await response.json();

      if (response.ok && typeof result.views === "number") {
        setEvents((prev) =>
          prev.map((item) =>
            item.id === event.id
              ? { ...item, views: result.views }
              : item
          )
        );

        setSelectedEvent((prev) =>
          prev?.id === event.id
            ? { ...prev, views: result.views }
            : prev
        );
      } else if (!response.ok) {
        console.error("Gagal mencatat views:", result.error);
      }
    } catch (error) {
      console.error("Gagal mengirim pencatatan views:", error);
    }
  }

  // Ambil ulasan event seperti sebelumnya.
  const { data } = await supabase
    .from("event_reviews")
    .select("*")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });

  if (data) {
    const userMap = new Map(
      registeredUsers.map((user) => [String(user.id), user])
    );

    const mapped = data.map((review: any) => {
      const user = userMap.get(String(review.user_id));

      return {
        ...review,
        username: user?.username || review.username || "user",
        display_name:
          user?.display_name ||
          user?.username ||
          review.display_name ||
          "Pengguna",
        avatar_url: user?.avatar_url || review.avatar_url || "",
      };
    });

    setReviews((prev) => [
      ...mapped,
      ...prev.filter((review) => review.event_id !== event.id),
    ]);
  }
};
  // Buka detail event otomatis ketika halaman diakses melalui link ?event=<id>.
  useEffect(() => {
    if (typeof window === "undefined" || !sessionReady || events.length === 0) return;

    const sharedEventId = new URLSearchParams(window.location.search).get("event");
    if (!sharedEventId || sharedEventOpenedRef.current === sharedEventId) return;

    const sharedEvent = events.find(
      (event) =>
        String(event.id) === sharedEventId &&
        event.moderation_status === "Approved"
    );

    if (sharedEvent) {
      sharedEventOpenedRef.current = sharedEventId;
      void openEvent(sharedEvent);
    }
  }, [events, sessionReady, currentRole]);

  useEffect(() => {
    if (currentRole !== "user" || !pendingGuestEvent) return;
    const eventToOpen = pendingGuestEvent;
    setPendingGuestEvent(null);
    void openEvent(eventToOpen);
  }, [currentRole, pendingGuestEvent]);

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

  // Bagikan tautan permanen berbasis ID event; halaman akan membuka detailnya saat link diakses.
 
const shareEvent = async (event: Event) => {
  const shareUrl = new URL(
    `/event/${encodeURIComponent(event.id)}`,
    window.location.origin
  );

  const shareData = {
    title: event.title,
    text: `Lihat event ${event.title} di NGIPEN – MAKICOS`,
    url: shareUrl.toString(),
  };

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        return;
      }
    }
  }

  try {
    await navigator.clipboard.writeText(shareUrl.toString());
    showToast("Link event berhasil disalin.");
  } catch {
    showToast(
      "Link tidak dapat disalin otomatis. Coba buka halaman melalui browser."
    );
  }
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
  src="/ngipen-logo.png"
  alt="Logo NGIPEN"
  onError={(event) => {
    event.currentTarget.style.display = "none";
  }}
  className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
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
  setShowCostumeDirectory(false);
  setShowCalendar(false);
  setUserTab("Semua");
}}
                className="text-sm font-semibold hover:text-red-600"
              >
                Beranda
              </button>

              <button
  onClick={() => {
  setSelectedEvent(null);
  setShowCostumeDirectory(false);
  setShowCalendar(false);
  setUserTab("Semua");

  window.scrollTo({ top: 0, behavior: "smooth" });

  setTimeout(() => {
    document
      .getElementById("daftar-event")
      ?.scrollIntoView({ behavior: "smooth" });
  }, 200);
}}
  className="text-sm font-semibold hover:text-red-600"
>
  Jelajahi Event
</button>
                            {currentRole === "user" && (
                <button
  onClick={() => {
  setSelectedEvent(null);
  setShowCostumeDirectory(true);
  setShowCalendar(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
}}
  className="text-sm font-semibold hover:text-red-600"
>
  Cari Costume
</button>
)}
{currentRole === "user" && (
  <button
    onClick={() => {
      setSelectedEvent(null);
      setShowCostumeDirectory(false);
      setShowCalendar(true);
      setCalendarMonth(new Date());
      setSelectedCalendarDate("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }}
    className="text-sm font-semibold hover:text-red-600"
  >
    Kalender
  </button>
)}
              {currentRole === "user" && (
                <button
                  onClick={() => {
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
  setShowCostumeDirectory(false);
  setShowCalendar(false);
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
  setSelectedEvent(null);
  setShowCostumeDirectory(false);
  setShowCalendar(false);
  setMobileOpen(false);
  setUserTab("Semua");

  window.scrollTo({ top: 0, behavior: "smooth" });

  setTimeout(() => {
    document
      .getElementById("daftar-event")
      ?.scrollIntoView({ behavior: "smooth" });
  }, 200);
}}
  className="rounded-xl px-3 py-3 text-left font-semibold hover:bg-gray-100 dark:hover:bg-gray-900"
>
  Jelajahi Event
</button>
                               {currentRole === "user" && (
  <button
    onClick={() => {
      setMobileOpen(false);
      setSelectedEvent(null);
      setShowCostumeDirectory(true);
      setShowCalendar(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }}
    className="rounded-xl px-3 py-3 text-left font-semibold hover:bg-gray-100 dark:hover:bg-gray-900"
  >
    Cari Costume
  </button>
)}
                
{currentRole === "user" && (
  <button
    onClick={() => {
  setMobileOpen(false);
  setSelectedEvent(null);
  setShowCostumeDirectory(false);
  setShowCalendar(true);
  setCalendarMonth(new Date());
  setSelectedCalendarDate("");
  window.scrollTo({ top: 0, behavior: "smooth" });
}}
    className="rounded-xl px-3 py-3 text-left font-semibold hover:bg-gray-100 dark:hover:bg-gray-900"
  >
    Kalender
  </button>
)}
                {currentRole === "user" && (
                  <button
                    onClick={() => {
                      setMobileOpen(false);
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
       {!selectedEvent && !showCostumeDirectory && (
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

                  <div className="mt-6 flex flex-wrap gap-3">
  <button
    onClick={() =>
      document
        .getElementById("daftar-event")
        ?.scrollIntoView({ behavior: "smooth" })
    }
    className="rounded-full bg-white px-5 py-3 text-sm font-bold text-red-700 hover:bg-red-50"
  >
    Jelajahi Event ↓
  </button>

  {currentRole === "user" && (
    <button
      type="button"
      onClick={() => {
        setSelectedEvent(null);
        setShowCostumeDirectory(true);
        setShowCalendar(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="rounded-full border border-white px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
    >
      Cari Costume
    </button>
  )}
</div>
                  <a
                    href="https://teer.id/makicos.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex rounded-full border border-white/80 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 sm:ml-3"
                  >
                    JOIN COMMUNITY ↗
                  </a>
                </div>
              </div>
            </section>

{!showCalendar && !showCostumeDirectory && currentRole === "user" && rentals.some((rental) => rental.is_subscription_active) && (
  <section className="mx-auto max-w-[1400px] px-4 pb-7">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-black sm:text-xl">Rental Costume Pilihan</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Partner Subscription aktif Makicos</p>
      </div>
      <button
        type="button"
        onClick={() => { setShowCostumeDirectory(true); setShowCalendar(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className="text-xs font-bold text-red-600 hover:text-red-700"
      >
        Lihat semua →
      </button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[...rentals].filter((rental) => rental.is_subscription_active).map((rental) => (
        <div key={rental.id} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-gray-900">
          <img src={rental.image_url} alt={rental.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{rental.name}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{rental.region}</p>
            <p className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">♛ Subscription</p>
          </div>
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => openRentalInstagram(rental)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">Instagram ↗</button>
            {rental.whatsapp_number && <button type="button" onClick={() => openRentalWhatsapp(rental)} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white">WhatsApp ↗</button>}
          </div>
        </div>
      ))}
    </div>
  </section>
)}

{!showCalendar && !showCostumeDirectory && currentRole === "guest" && (
  <section className="mx-auto max-w-[1400px] px-4 pb-7">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-black sm:text-xl">Rental Costume Pilihan</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Partner Subscription aktif Makicos</p>
      </div>
      <button type="button" onClick={() => setShowLoginUser(true)} className="text-xs font-bold text-red-600 hover:text-red-700">Lihat selengkapnya →</button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rentals.filter((rental) => rental.is_subscription_active).slice(0, 3).map((rental) => (
        <div key={rental.id} className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-white p-3 dark:border-amber-900 dark:bg-gray-900">
          <img src={rental.image_url} alt={rental.name} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{rental.name}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{rental.region}</p>
            <p className="mt-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">♛ Subscription</p>
          </div>
        </div>
      ))}
    </div>
  </section>
)}

{showCalendar && currentRole === "user" && (
  <section id="user-event-calendar" className="mx-auto max-w-[1400px] px-4 pb-8">
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-7">

      {/* HEADER KALENDER */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black">Kalender Event</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Temukan event jejepangan berdasarkan tanggal.
          </p>
        </div>

        <button
          onClick={() => {
            setShowCalendar(false);
            setSelectedCalendarDate("");
          }}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          Tutup Kalender
        </button>
      </div>

      {/* NAVIGASI BULAN */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          onClick={() =>
            setCalendarMonth((prev) =>
              new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
            )
          }
          className="rounded-xl border border-gray-200 px-4 py-2 font-bold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          ←
        </button>

        <h3 className="text-lg font-bold capitalize">
          {calendarMonth.toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric",
          })}
        </h3>

        <button
          onClick={() =>
            setCalendarMonth((prev) =>
              new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
            )
          }
          className="rounded-xl border border-gray-200 px-4 py-2 font-bold hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          →
        </button>
      </div>

     {/* ISI KALENDER */}
{(() => {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayKey = toDateKey(today);

  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(
          (day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-bold text-gray-500 sm:text-sm"
            >
              {day}
            </div>
          )
        )}

        {calendarCells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} />;
          }

          const date = new Date(year, month, day);
          const dateKey = toDateKey(date);
          const isPast = dateKey < todayKey;
          const isSelected = selectedCalendarDate === dateKey;

          const dayEvents = !isPast
            ? approvedEvents
                .filter((event) => {
                  const startDate = event.start_date;
                  const endDate = event.end_date || event.start_date;

                  return (
                    startDate <= dateKey &&
                    endDate >= dateKey &&
                    getTimeStatus(event) !== "Completed"
                  );
                })
                .sort((a, b) => {
                  const timeCompare = a.created_at.localeCompare(b.created_at);

                  if (timeCompare !== 0) return timeCompare;

                  return a.title.localeCompare(b.title, "id", {
                    sensitivity: "base",
                  });
                })
            : [];

          const maxVisible = isMobileCalendar ? 2 : 3;
          const visibleEvents = dayEvents.slice(0, maxVisible);
         const remainingEvents = Math.max(0, dayEvents.length - maxVisible);

          return (
            <button
              key={dateKey}
              disabled={isPast}
              onClick={() => setSelectedCalendarDate(dateKey)}
              className={`relative flex min-h-[85px] flex-col items-stretch rounded-xl border p-1 text-left transition sm:min-h-[125px] sm:p-2
                ${
                  isSelected
                    ? "border-red-600 bg-red-600 text-white"
                    : isPast
                      ? "cursor-not-allowed border-transparent text-gray-300 dark:text-gray-700"
                      : "border-gray-100 hover:border-red-400 hover:bg-red-50 dark:border-gray-800 dark:hover:bg-red-950"
                }`}
            >
              <span className="mb-1 text-center text-xs font-bold sm:text-sm">
                {day}
              </span>

              <div className="flex flex-col gap-1 overflow-hidden">
                {visibleEvents.map((event) => (
                  <span
                    key={event.id}
                    title={event.title}
                    className={`block truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight sm:text-[10px]
                      ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      }`}
                  >
                    {event.title}
                  </span>
                ))}

                {remainingEvents > 0 && (
                  <span
                    className={`truncate text-[8px] font-semibold sm:text-[10px]
                      ${
                        isSelected
                          ? "text-white"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                  >
                    +{remainingEvents} event lainnya
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
        Tanggal dengan event
      </div>
    </>
  );
})()}

      {/* DAFTAR EVENT BERDASARKAN TANGGAL */}
      <div id="calendar-event-list" className="mt-8 border-t border-gray-200 pt-6 dark:border-gray-800">
        {!selectedCalendarDate ? (
          <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            Pilih tanggal pada kalender untuk melihat event.
          </div>
        ) : (
          <>
            <h3 className="mb-4 text-lg font-bold">
              Event tanggal{" "}
              {new Date(
                selectedCalendarDate + "T00:00:00"
              ).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h3>

            {calendarEvents.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-6 text-center dark:bg-gray-800">
                <p className="font-semibold">
                  Belum ada event pada tanggal ini.
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Coba pilih tanggal lainnya.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {calendarEvents.map((event) => (
                  <button
                    key={event.id}
                    onPointerDown={(pointerEvent) => beginEventPreview(event, pointerEvent)}
                    onPointerMove={moveEventPreviewPointer}
                    onPointerUp={endEventPreview}
                    onPointerLeave={endEventPreview}
                    onPointerCancel={endEventPreview}
                    onContextMenu={(contextEvent) => contextEvent.preventDefault()}
                    onClick={() => {
                      if (suppressNextEventClickRef.current) {
                        suppressNextEventClickRef.current = false;
                        return;
                      }
                      eventOpenSourceRef.current = "calendar";
                      calendarScrollYRef.current = window.scrollY;
                      setSelectedEvent(event);
                      setShowCalendar(false);
                    }}
                    className="overflow-hidden rounded-2xl border border-gray-200 text-left transition hover:border-red-500 hover:shadow-md dark:border-gray-700"
                  >
                    {event.poster_url && (
                      <img
                        src={event.poster_url}
                        alt={event.title}
                       className="block h-auto w-full object-contain"
                      />
                    )}

                    <div className="p-4">
                      <h4 className="font-bold">{event.title}</h4>

                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        📍 {event.city}, {event.province}
                      </p>

                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        📅 {new Date(
                          event.start_date + "T00:00:00"
                        ).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {event.end_date &&
                          event.end_date !== event.start_date &&
                          ` - ${new Date(
                            event.end_date + "T00:00:00"
                          ).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}`}
                      </p>

                      <p className="mt-3 text-xs font-bold text-red-600">
                        Lihat Detail Event →
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  </section>
)}

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
                                      setPosterFile(null);
                      setPosterPreview("");
                      setPosterError("");
                      setEventFormOpen(true);
                    }}
                    className="shrink-0 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
                  >
                    + Upload Poster Event
                  </button>
                  <button
  onClick={() => {
    setSelectedEvent(null);
    setShowCalendar(true);
    setCalendarMonth(new Date());
    setSelectedCalendarDate("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }}
  className="shrink-0 rounded-xl border border-red-600 px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-gray-800"
>
  📅 Buka Kalender Event
</button>
                </div>
              </section>
            )}

            {/* PROMOSIKAN EVENT — KONTAK WHATSAPP */}
            {currentRole === "user" && (
              <section className="mx-auto max-w-[1400px] px-4 pb-8">
                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30 sm:flex-row sm:items-center sm:p-6">
                  <div className="max-w-3xl">
                    <p className="text-xs font-black uppercase tracking-wider text-red-600 dark:text-red-300">
                      Promosi NGIPEN
                    </p>
                    <h2 className="mt-1 text-xl font-black sm:text-2xl">
                      Ingin event kamu lebih dikenal?
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      Hubungi tim NGIPEN untuk menanyakan promosi atau sponsor event kamu melalui WhatsApp.
                    </p>
                  </div>
                  <a
                    href="https://wa.me/6281381067774?text=Halo%20tim%20NGIPEN%2C%20saya%20ingin%20menanyakan%20promosi%20event."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-700"
                  >
                    <span aria-hidden="true">💬</span>
                    Promosikan Event via WhatsApp
                  </a>
                </div>
              </section>
            )}

            {/* CAROUSEL SPONSOR / PROMOTE */}
           {!showCostumeDirectory && sponsoredEvents.length > 0 && (
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

                
<div
  ref={sponsorCarouselRef}
  onMouseEnter={() => {
    sponsorCarouselPausedRef.current = true;
  }}
  onMouseLeave={() => {
    sponsorCarouselPausedRef.current = false;
  }}
  onTouchStart={() => {
    sponsorCarouselPausedRef.current = true;
  }}
  onTouchEnd={() => {
    sponsorCarouselPausedRef.current = false;
  }}
  onFocusCapture={() => {
    sponsorCarouselPausedRef.current = true;
  }}
  onBlurCapture={() => {
    sponsorCarouselPausedRef.current = false;
  }}
  className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3"
>
  {sponsoredEvents.map((event) => (
    <button
      key={event.id}
      type="button"
      onPointerDown={(pointerEvent) => beginEventPreview(event, pointerEvent)}
      onPointerMove={moveEventPreviewPointer}
      onPointerUp={endEventPreview}
      onPointerLeave={endEventPreview}
      onPointerCancel={endEventPreview}
      onContextMenu={(contextEvent) => contextEvent.preventDefault()}
      onClick={() => handleEventCardClick(event)}
      className="group w-full min-w-full shrink-0 snap-start overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition-transform duration-300 dark:border-gray-800 dark:bg-gray-900 md:grid md:min-h-[250px] md:grid-cols-[300px_minmax(0,1fr)] md:hover:scale-[1.015]"
    >
      <div className="relative w-full overflow-hidden bg-gray-100 dark:bg-gray-800 md:flex md:h-[250px] md:items-center md:justify-center">
        {event.poster_url ? (
          <>
            <img src={event.poster_url} alt="" aria-hidden="true" className="absolute inset-0 hidden h-full w-full scale-110 object-cover opacity-45 blur-md md:block" />
            <img src={event.poster_url} alt={`Poster ${event.title}`} loading="lazy" className="relative block h-auto max-h-[420px] w-full object-contain md:max-h-[230px] md:w-auto md:max-w-full" />
          </>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-gray-500 md:h-full">Poster tidak tersedia</div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-gray-950">★ SPONSOR</span>
      </div>
      <div className="flex min-w-0 flex-col justify-center p-4 sm:p-5 md:p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Event pilihan partner</p>
        <h3 className="mt-1 line-clamp-2 text-base font-black sm:text-lg">{event.title}</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">📍 {event.venue_address || event.city}, {event.province}</p>
        <p className="mt-1 text-sm font-bold text-red-600">📅 {formatEventDate(event.start_date, event.end_date)}</p>
        {event.description && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{event.description}</p>}
        <span className="mt-4 text-xs font-black text-red-600">Lihat detail event →</span>
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
{!showCostumeDirectory && (
            <section
              id="daftar-event"
              className="mx-auto max-w-[1400px] scroll-mt-24 px-4 pb-12"
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
                   onClick={() => {
  setUserTab("Semua");
  setEventStatusTab("Semua");
}}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                      userTab === "Semua"
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                    }`}
                  >
                                        Semua Event ({eventFilterCounts.semua})
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowThisWeekOnly((value) => !value)}
                    aria-pressed={showThisWeekOnly}
                    className={`rounded-full px-4 py-2 text-sm font-bold ${
                      showThisWeekOnly
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
                    }`}
                  >
                                        Minggu Ini ({eventFilterCounts.mingguIni})
                  </button>

{(["Upcoming", "Ongoing", "Completed"] as const).map((status) => (
  <button
    key={status}
    onClick={() => setEventStatusTab(status)}
    className={`rounded-full px-4 py-2 text-sm font-bold ${
      eventStatusTab === status
        ? "bg-red-600 text-white"
        : "bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300"
    }`}
  >
   {status === "Completed"
  ? `Selesai (${eventFilterCounts.completed})`
  : status === "Upcoming"
    ? `Upcoming (${eventFilterCounts.upcoming})`
    : `Ongoing (${eventFilterCounts.ongoing})`}
  </button>
))}

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
                <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                  {paginatedEvents.map((event) => (
                    <article
                      key={event.id}
                      className="group overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900"
                    >
                      <button
                        type="button"
                        onPointerDown={(pointerEvent) => beginEventPreview(event, pointerEvent)}
                        onPointerMove={moveEventPreviewPointer}
                        onPointerUp={endEventPreview}
                        onPointerLeave={endEventPreview}
                        onPointerCancel={endEventPreview}
                        onContextMenu={(contextEvent) => contextEvent.preventDefault()}
                        onClick={() => handleEventCardClick(event)}
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

{(() => {
  const start = new Date(event.start_date + "T00:00:00");
  const end = new Date((event.end_date || event.start_date) + "T00:00:00");
  const duration = Math.round(
    (end.getTime() - start.getTime()) / 86400000
  ) + 1;

  if (duration < 1 || duration > 3) return null;

  return (
    <span className="absolute right-2 bottom-10 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-black text-white shadow-md">
      {duration}D
    </span>
  );
})()}

{getTimeStatus(event) === "Completed" && (
  <span className="absolute right-2 top-2 rounded-full bg-gray-800 px-2 py-1 text-[10px] font-black text-white">
    COMPLETED
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
                            📅 {formatEventDate(event.start_date, event.end_date)}
                          </p>
<div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
    />
    <circle cx="12" cy="12" r="3" />
  </svg>
  <span>{(event.views || 0).toLocaleString("id-ID")} views</span>
</div>
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

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void shareEvent(event)}
                            aria-label={`Bagikan link event ${event.title}`}
                            title="Bagikan link event"
                            className="rounded-lg px-3 py-1 text-sm text-gray-500 hover:text-red-600"
                          >
                            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                              <circle cx="18" cy="5" r="3" />
                              <circle cx="6" cy="12" r="3" />
                              <circle cx="18" cy="19" r="3" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2" />
                            </svg>
                          </button>

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
                      </div>
                    </article>
                  ))}
                </div>

                {totalEventPages > 1 && (
                  <nav
                    aria-label="Navigasi halaman daftar event"
                    className="mt-8 flex flex-wrap items-center justify-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => goToEventPage(currentEventPage - 1)}
                      disabled={currentEventPage === 1}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold transition hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700"
                    >
                      ← Sebelumnya
                    </button>

                    {visibleEventPages.map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => goToEventPage(page)}
                        aria-current={currentEventPage === page ? "page" : undefined}
                        className={`h-10 min-w-10 rounded-xl px-3 text-sm font-bold transition ${
                          currentEventPage === page
                            ? "bg-red-600 text-white"
                            : "border border-gray-200 hover:border-red-500 hover:text-red-600 dark:border-gray-700"
                        }`}
                      >
                        {page}
                      </button>
                    ))}

                    <span className="px-1 text-xs text-gray-500">
                      {currentEventPage} / {totalEventPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => goToEventPage(currentEventPage + 1)}
                      disabled={currentEventPage === totalEventPages}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold transition hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700"
                    >
                      Berikutnya →
                    </button>
                  </nav>
                )}
                </>
              )}
                      </section>
          )}
          </main>
        )}
        
        {/* HALAMAN CARI COSTUME */}
{showCostumeDirectory && !selectedEvent && (
  <section
    key="costume-directory"
    className="mx-auto min-h-[60vh] max-w-[1100px] animate-[fadeIn_0.35s_ease-out] px-4 py-8"
  >
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black sm:text-3xl">PARTNER SHIP MAKICOS</h2>
        {currentRole === "user" && (
          <div className="flex w-full gap-2 sm:w-auto">
            <a href="https://wa.me/6281381067774?text=Halo%20MAKICOS%2C%20saya%20ingin%20berlangganan%20rental%20costume%20untuk%20ditampilkan%20di%20NGIPEN." target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg bg-amber-500 px-3 py-2.5 text-center text-xs font-black text-white sm:flex-none">Subscribe</a>
            <a href="https://forms.gle/oHxPoxk7ortqRJ1RA" target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg border border-red-600 px-3 py-2.5 text-center text-xs font-black text-red-600 sm:flex-none">Daftarkan Rentalan</a>
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Temukan partner rental costume untuk kebutuhan cosplay-mu.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
            ✓ Partner Ship
          </p>
          <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-300/80">
            Rental yang telah menjadi partner resmi Makicos.
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
            ♛ Subscription
          </p>
          <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80">
            Rental yang berlangganan layanan Paid Promote Makicos.
          </p>
        </div>
      </div>
    </div>

            {(() => {
              const normalized = (value: string | null | undefined) => (value || "").trim().toLocaleLowerCase("id-ID");
              const provinces = Array.from(new Set(rentals.map((r) => r.province).filter((v): v is string => !!v?.trim()))).sort((a, b) => a.localeCompare(b, "id"));
              const cities = Array.from(new Set(rentals.filter((r) => rentalFilterProvince === "Semua" || normalized(r.province) === normalized(rentalFilterProvince)).map((r) => r.city).filter((v): v is string => !!v?.trim()))).sort((a, b) => a.localeCompare(b, "id"));
              const filtered = rentals.filter((r) =>
                (rentalFilterProvince === "Semua" || normalized(r.province) === normalized(rentalFilterProvince)) &&
                (rentalFilterCity === "Semua" || normalized(r.city) === normalized(rentalFilterCity))
              );
              const subscription = filtered.filter((r) => r.is_subscription_active);
              const verified = filtered.filter((r) => !r.is_subscription_active && r.is_verified);
              const free = filtered.filter((r) => !r.is_subscription_active && !r.is_verified);
              const pageSize = isMobileCalendar ? 8 : 9;
              const renderCards = (items: CostumeRental[], tier: "subscription" | "verified" | "free", paginated = false, page = 1) => {
                const visible = paginated ? items.slice((page - 1) * pageSize, page * pageSize) : items;
                const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
                return <>
                  {items.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">Belum ada rental pada kategori dan filter ini.</p> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((rental) => (
                      <div key={rental.id} className="min-w-0">
                      <article className={`flex min-w-0 flex-col overflow-hidden rounded-xl border bg-white p-2 shadow-sm dark:bg-gray-900 ${tier === "subscription" ? "border-2 border-amber-400 shadow-amber-100/70 dark:border-amber-500 dark:shadow-amber-950/30" : tier === "verified" ? "border-2 border-blue-300 dark:border-blue-700" : "border-gray-300 dark:border-gray-700"} sm:rounded-xl`}>
                        <div className="flex min-w-0 gap-2">
                          <div className={`relative shrink-0 rounded-xl p-0.5 ${tier === "subscription" ? "bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-700" : tier === "verified" ? "bg-gradient-to-br from-sky-300 via-blue-500 to-blue-700" : "bg-gradient-to-br from-gray-200 via-gray-400 to-gray-500"}`}>
                            {tier === "subscription" && <span className="absolute -right-1.5 -top-2 z-10 text-lg drop-shadow" aria-label="Subscription">👑</span>}
                            <img src={rental.image_url} alt={rental.name} className="h-20 w-20 rounded-[10px] object-cover sm:h-24 sm:w-24" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-1">
                              {tier === "subscription" && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-300">♛ SUBSCRIPTION</span>}
                              {tier === "verified" && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-black text-blue-800 dark:bg-blue-950 dark:text-blue-300">✓ VERIFIED</span>}
                              {tier === "free" && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">BASIC</span>}
                            </div>
                            <h3 className={`line-clamp-2 break-words text-xs sm:text-sm ${tier === "subscription" ? "font-black" : "font-bold"}`}>{rental.name}</h3>
                            <p className="mt-1 break-words text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">📍 {rental.city && rental.province ? `${rental.city}, ${rental.province}` : rental.region}</p>
                            <p className="mt-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400">◉ {Number(rental.total_views || 0).toLocaleString("id-ID")} views</p>
                          </div>
                        </div>
                      </article>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        <button type="button" onClick={() => openRentalInstagram(rental)} className="min-w-0 rounded-lg bg-red-600 px-1.5 py-2 text-[10px] font-bold text-white hover:bg-red-700 sm:text-xs">Instagram ↗</button>
                        <button type="button" onClick={() => openRentalWhatsapp(rental)} disabled={!rental.whatsapp_number} className="min-w-0 rounded-lg bg-green-600 px-1.5 py-2 text-[10px] font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs">WhatsApp ↗</button>
                      </div>
                      </div>
                    ))}
                  </div>}
                  {paginated && items.length > pageSize && <div className="mt-4 flex items-center justify-center gap-3">
                    <button type="button" disabled={page <= 1} onClick={() => tier === "verified" ? setVerifiedRentalPage(page - 1) : setFreeRentalPage(page - 1)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold disabled:opacity-40 dark:border-gray-700">← Sebelumnya</button>
                    <span className="text-xs text-gray-500">Halaman {page} / {totalPages}</span>
                    <button type="button" disabled={page >= totalPages} onClick={() => tier === "verified" ? setVerifiedRentalPage(page + 1) : setFreeRentalPage(page + 1)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold disabled:opacity-40 dark:border-gray-700">Berikutnya →</button>
                  </div>}
                </>;
              };
              return <>
                <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <label className="min-w-[180px] flex-1 text-xs font-semibold">Provinsi
                    <select value={rentalFilterProvince} onChange={(e) => { setRentalFilterProvince(e.target.value); setRentalFilterCity("Semua"); setVerifiedRentalPage(1); setFreeRentalPage(1); }} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950">
                      <option value="Semua">Semua Provinsi</option>{provinces.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label className="min-w-[180px] flex-1 text-xs font-semibold">Kota / Kabupaten
                    <select value={rentalFilterCity} onChange={(e) => { setRentalFilterCity(e.target.value); setVerifiedRentalPage(1); setFreeRentalPage(1); }} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-950">
                      <option value="Semua">Semua Kota</option>{cities.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => { setRentalFilterProvince("Semua"); setRentalFilterCity("Semua"); setVerifiedRentalPage(1); setFreeRentalPage(1); }} className="rounded-lg border border-gray-300 px-4 py-2.5 text-xs font-bold dark:border-gray-700">Reset Filter</button>
                </div>
                {rentalLoading ? <div className="rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-500 dark:border-gray-800">Memuat daftar rental...</div> : <div className="space-y-7">
                  <section><h3 className="mb-3 text-base font-black text-amber-700 dark:text-amber-300">♛ Subscription <span className="text-xs font-semibold text-gray-500">({subscription.length})</span></h3>{renderCards(subscription, "subscription")}</section>
                  <section><h3 className="mb-3 text-base font-black text-blue-700 dark:text-blue-300">✓ Verified <span className="text-xs font-semibold text-gray-500">({verified.length})</span></h3>{renderCards(verified, "verified", true, verifiedRentalPage)}</section>
                  <section><h3 className="mb-3 text-base font-black text-gray-700 dark:text-gray-200">BASIC <span className="text-xs font-semibold text-gray-500">({free.length})</span></h3>{renderCards(free, "free", true, freeRentalPage)}</section>
                </div>}
              </>;
            })()}

            <button
              type="button"
             onClick={() => {
  setShowCostumeDirectory(false);
  setShowCalendar(false);
  setSelectedEvent(null);
  setUserTab("Semua");
  window.scrollTo({ top: 0, behavior: "smooth" });
}}
              className="mt-8 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white"
            >
              ← Kembali ke Beranda
            </button>
          </section>
        )}
        
        {/* HALAMAN DETAIL EVENT */}
        {selectedEvent && (
          <main className="mx-auto min-h-screen max-w-[1200px] px-4 py-6 sm:py-10">
            <div className="mb-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedEvent(null);
                  sharedEventOpenedRef.current = null;
                  eventOpenSourceRef.current = "explore";
                  setShowCalendar(false);
                  setShowCostumeDirectory(false);
                  const cleanUrl = new URL(window.location.href);
                  cleanUrl.searchParams.delete("event");
                  window.history.replaceState({}, "", cleanUrl.toString());
                  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold hover:border-red-500 hover:text-red-600 dark:border-gray-700 dark:bg-gray-900"
              >
                ← Kembali ke Beranda
              </button>
              {eventOpenSourceRef.current === "calendar" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEvent(null);
                    sharedEventOpenedRef.current = null;
                    setShowCostumeDirectory(false);
                    setShowCalendar(true);
                    const cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete("event");
                    window.history.replaceState({}, "", cleanUrl.toString());
                    window.setTimeout(() => {
                      document.getElementById("calendar-event-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      if (!document.getElementById("calendar-event-list")) {
                        window.scrollTo({ top: calendarScrollYRef.current, behavior: "smooth" });
                      }
                    }, 80);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:border-red-500 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  <span aria-hidden="true">▦</span> Kembali ke Kalender
                </button>
              )}
            </div>

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
  📅 {formatEventDate(selectedEvent.start_date, selectedEvent.end_date)}
</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Waktu
                    </p>
                    <p className="mt-1 font-semibold">
                      🕒 {selectedEvent.start_time?.slice(0, 5).replace(":", ".")} – {selectedEvent.end_time?.slice(0, 5).replace(":", ".")}
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

  <p
    className={`mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-300 ${
      descriptionExpanded ? "" : "line-clamp-4"
    }`}
  >
    {selectedEvent.description}
  </p>

  {(selectedEvent.description || "").length > 180 && (
    <button
      type="button"
      onClick={() => setDescriptionExpanded((prev) => !prev)}
      className="mt-2 text-sm font-bold text-red-600 hover:text-red-700"
    >
      {descriptionExpanded ? "Sembunyikan" : "Lihat selengkapnya"}
    </button>
  )}
</div>

                {/* TOMBOL AKSI */}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void shareEvent(selectedEvent)}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-bold hover:border-red-500 hover:text-red-600 dark:border-gray-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.7 10.6 6.6-4.2M8.7 13.4l6.6 4.2" />
                    </svg>
                    Share Link Event
                  </button>

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

                  {selectedEvent.social_link && (
                    <a
                      href={selectedEvent.social_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold hover:border-red-500 dark:border-gray-700"
                    >
                      Media Sosial / Info Event ↗
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

                  {getTimeStatus(selectedEvent) === "Completed" && (
                    <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-3 dark:border-gray-700">
                      <label htmlFor="comment-documentation-file" className="text-sm font-bold">
                        Lampirkan dokumentasi event (opsional)
                      </label>
                      <input
                        id="comment-documentation-file"
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          if (file && !file.type.startsWith("image/")) {
                            setToast("File dokumentasi harus berupa gambar.");
                            event.target.value = "";
                            setDocFile(null);
                            return;
                          }
                          if (file && file.size > 10 * 1024 * 1024) {
                            setToast("Ukuran dokumentasi maksimal 10 MB.");
                            event.target.value = "";
                            setDocFile(null);
                            return;
                          }
                          setDocFile(file);
                        }}
                        className="mt-2 block w-full text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">Format gambar, maksimal 10 MB. Lampiran hanya tersedia setelah event selesai.</p>
                      {docFile && <p className="mt-1 text-xs text-green-600">Dipilih: {docFile.name}</p>}
                    </div>
                  )}

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
                      
accept="image/jpeg,image/png,image/webp"
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
                setPendingGuestEvent(null);
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
                  <div className="relative">
                    <input
                      id="login-user-p"
                      type={showLoginPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="Masukkan password"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 hover:text-red-600"
                      aria-label={showLoginPassword ? "Sembunyikan password" : "Tampilkan password"}
                      title={showLoginPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showLoginPassword ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.3 2.2-2.5 3.3M6.2 6.2C3.9 7.7 2.7 9.8 2.5 12c.7 1.8 3.9 7 9.5 7 1 0 2-.2 2.9-.6" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
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
                setPendingGuestEvent(null);
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
                  <div className="relative">
                    <input
                      id="reg-user-p"
                      type={showRegPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      placeholder="Minimal 8 karakter"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 hover:text-red-600"
                      aria-label={showRegPassword ? "Sembunyikan password" : "Tampilkan password"}
                      title={showRegPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showRegPassword ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.3 2.2-2.5 3.3M6.2 6.2C3.9 7.7 2.7 9.8 2.5 12c.7 1.8 3.9 7 9.5 7 1 0 2-.2 2.9-.6" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
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
            <section className={`my-auto max-h-[95vh] w-full overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:p-7 ${currentRole === "admin" ? "max-w-7xl" : "max-w-lg"}`}>
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
                                        <button
                      onClick={() => setAdminTab("rentals")}
                      className={`rounded-xl px-3 py-2 text-sm font-bold ${
                        adminTab === "rentals"
                          ? "bg-red-600 text-white"
                          : "bg-gray-100 dark:bg-gray-800"
                      }`}
                    >
                      Konfigurasi List Rentalan
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                      <p className="text-xs text-gray-500">Total pengguna</p>
                      <p className="mt-1 text-2xl font-black">{registeredUsers.length}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                      <p className="text-xs text-amber-800 dark:text-amber-300">Menunggu persetujuan</p>
                      <p className="mt-1 text-2xl font-black">{events.filter((event) => event.moderation_status === "Pending").length}</p>
                    </div>
                    <div className="rounded-xl border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/40">
                      <p className="text-xs text-green-800 dark:text-green-300">Disetujui</p>
                      <p className="mt-1 text-2xl font-black">{events.filter((event) => event.moderation_status === "Approved").length}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                      <p className="text-xs text-gray-500">Total event</p>
                      <p className="mt-1 text-2xl font-black">{events.length}</p>
                    </div>
                  </div>

                  {adminTab === "moderation" ? (
                    <div className="mt-5 space-y-4">
                      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
                        {([
                          ["Pending", "Menunggu", "amber"],
                          ["Approved", "Disetujui", "green"],
                          ["Rejected", "Ditolak", "red"],
                          ["Sponsored", "Disponsori", "orange"],
                          ["Completed", "Event Selesai", "gray"],
                          ["Hidden", "Disembunyikan", "gray"],
                        ] as const).map(([tab, label]) => {
                          const count = events.filter((event) => {
                            const completed = getTimeStatus(event) === "Completed";
                            if (tab === "Completed") return completed;
                            if (completed) return false;
                            if (tab === "Pending") return event.moderation_status === "Pending";
                            if (tab === "Approved") return event.moderation_status === "Approved" && !event.is_sponsored;
                            if (tab === "Rejected") return event.moderation_status === "Rejected";
                            if (tab === "Sponsored") return event.moderation_status === "Approved" && event.is_sponsored;
                            return event.moderation_status === "Hidden";
                          }).length;

                          return (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setAdminEventTab(tab)}
                              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition ${
                                adminEventTab === tab
                                  ? "bg-red-600 text-white shadow-sm"
                                  : "border border-gray-200 bg-white text-gray-600 hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                              }`}
                            >
                              {label}
                              <span className={`rounded-full px-2 py-0.5 text-xs ${adminEventTab === tab ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {adminEventTab === "Completed" && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                          Event pada daftar ini sudah melewati tanggal dan waktu selesai. Penghapusan bersifat permanen dan memerlukan konfirmasi.
                        </div>
                      )}

                      {adminFilteredEvents.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-gray-700">
                          <p className="font-bold">Belum ada event di kategori ini.</p>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Event yang sesuai akan muncul di sini.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {adminFilteredEvents.map((event) => (
                            <article key={event.id} className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-4">
                              <div className="flex min-w-0 gap-3">
                                {event.poster_url ? (
                                  <img src={event.poster_url} alt={`Poster ${event.title}`} className="h-24 w-16 shrink-0 rounded-xl border border-gray-100 object-cover dark:border-gray-700 sm:h-28 sm:w-[76px]" />
                                ) : (
                                  <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400 dark:bg-gray-800 sm:h-28 sm:w-[76px]">No poster</div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <h4 className="break-words font-bold leading-snug text-gray-900 dark:text-white">{event.title}</h4>
                                  <p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{event.organizer_name || "Penyelenggara"}</p>
                                  <p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{event.city}{event.province ? `, ${event.province}` : ""}</p>
                                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{event.start_date} – {event.end_date}</p>
                                  {adminEventTab === "Completed" ? (
                                    <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">Selesai</span>
                                  ) : adminEventTab === "Pending" ? (
                                    <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Menunggu</span>
                                  ) : adminEventTab === "Approved" ? (
                                    <span className="mt-2 inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800 dark:bg-green-950 dark:text-green-200">Disetujui</span>
                                  ) : adminEventTab === "Rejected" ? (
                                    <span className="mt-2 inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800 dark:bg-red-950 dark:text-red-200">Ditolak</span>
                                  ) : adminEventTab === "Sponsored" ? (
                                    <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">★ Sponsor aktif</span>
                                  ) : (
                                    <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">Disembunyikan</span>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                                {adminEventTab === "Pending" && (
                                  <>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Approved")} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700">Setujui</button>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Rejected")} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">Tolak</button>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Approved", true, 1)} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-gray-950 hover:bg-amber-500">Setujui & Sponsor</button>
                                  </>
                                )}
                                {adminEventTab === "Approved" && (
                                  <>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Rejected", false, 0)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">Tolak</button>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Approved", true, 1)} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-gray-950 hover:bg-amber-500">Jadikan Sponsor</button>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Hidden")} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">Sembunyikan</button>
                                  </>
                                )}
                                {adminEventTab === "Rejected" && (
                                  <>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Approved", false, 0)} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700">Setujui</button>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Pending", false, 0)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700">Kembalikan ke antrean</button>
                                  </>
                                )}
                                {adminEventTab === "Sponsored" && (
                                  <>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Approved", false, 0)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700">Hapus Sponsor</button>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Rejected", false, 0)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">Tolak Event</button>
                                  </>
                                )}
                                {adminEventTab === "Hidden" && (
                                  <button type="button" onClick={() => void handleModeration(event.id, "Approved")} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700">Tampilkan Kembali</button>
                                )}
                                {adminEventTab === "Completed" && (
                                  <button type="button" onClick={() => void handleDeleteCompletedEvent(event)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">
                                    <span aria-hidden="true">🗑</span> Hapus Event
                                  </button>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                      
                                        </div>
                  ) : adminTab === "users" ? (
                    <div className="mt-4 max-h-[55vh] overflow-y-auto">
                      <div className="mb-3 rounded-xl bg-gray-50 p-3 text-sm font-bold dark:bg-gray-950">
                        Total {registeredUsers.length} pengguna terdaftar
                      </div>
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
              ) : (
                <div className="mt-4 space-y-5">
                  <div id="admin-rental-form" className={`rounded-2xl border p-4 transition-all duration-500 dark:border-gray-800 ${rentalFormHighlight ? "border-red-500 bg-red-50 shadow-lg shadow-red-200/60 ring-2 ring-red-300 dark:bg-red-950/30 dark:shadow-red-950/40" : "border-gray-200"}`}>
                    <h3 className="font-bold">
                      {editingRentalId ? "Edit Rental Costume" : "Tambah Rental Costume"}
                    </h3>

                    <p className="mt-1 text-xs text-gray-500">
                      Foto wajib berbentuk persegi 1:1, format JPG, PNG, atau WEBP, maksimal 5 MB.
                    </p>

                    <div className="mt-4 space-y-3">
                      <input
                        type="text"
                        value={rentalName}
                        onChange={(event) => setRentalName(event.target.value)}
                        placeholder="Nama rental costume"
                        className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-red-500 dark:border-gray-700"
                      />

                      <label className="block text-sm font-semibold">
                        Provinsi <span className="text-red-600">*</span>
                        <select
                          value={rentalProvince}
                          onChange={(event) => {
                            setRentalProvince(event.target.value);
                            setRentalCity("");
                          }}
                          required
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950"
                        >
                          <option value="">Pilih Provinsi</option>
                          {ALL_PROVINCES.map((province) => (
                            <option key={province} value={province}>
                              {province}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-sm font-semibold">
                        Kota / Kabupaten <span className="text-red-600">*</span>
                        <input
                          type="text"
                          value={rentalCity}
                          onChange={(event) => setRentalCity(event.target.value)}
                          placeholder="Contoh: Tangerang Selatan"
                          maxLength={100}
                          required
                          className="mt-1 w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-red-500 dark:border-gray-700"
                        />
                      </label>

                      <input
                        type="url"
                        value={rentalInstagram}
                        onChange={(event) => setRentalInstagram(event.target.value)}
                        placeholder="Link Instagram rental"
                        className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-red-500 dark:border-gray-700"
                      />

                      <input
                        type="tel"
                        value={rentalWhatsapp}
                        onChange={(event) => setRentalWhatsapp(event.target.value)}
                        placeholder="Nomor WhatsApp (contoh: 628123456789)"
                        className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-red-500 dark:border-gray-700"
                      />

                      <div>
                        <label className="mb-2 block text-sm font-semibold">Tanggal akhir Subscription</label>
                        <input
                          type="date"
                          value={rentalSubscriptionExpiry}
                          onChange={(event) => setRentalSubscriptionExpiry(event.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-red-500 dark:border-gray-700"
                        />
                        <p className="mt-1 text-xs text-gray-500">Isi tanggal ini sebelum mengaktifkan Subscription.</p>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold">
                          Foto / Logo Rental
                        </label>

                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            handleRentalImage(event.target.files?.[0] || null)
                          }
                          className="w-full text-sm"
                        />

                                               {rentalPreview && (
                          <img
                            src={rentalPreview}
                            alt="Preview rental"
                            className="mt-3 h-28 w-28 rounded-xl object-cover"
                          />
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleSaveRental()}
                          disabled={rentalSaving}
                          className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {rentalSaving
                            ? "Menyimpan..."
                            : editingRentalId
                              ? "Simpan Perubahan"
                              : "Tambah Rental"}
                        </button>

                        {editingRentalId && (
                          <button
                            type="button"
                            onClick={resetRentalForm}
                            className="rounded-xl bg-gray-100 px-5 py-3 text-sm font-bold dark:bg-gray-800"
                          >
                            Batal Edit
                          </button>
                        )}
                                         </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 font-bold">
                      Daftar Rental ({rentals.length})
                    </h3>

                    {rentalLoading ? (
                      <p className="py-6 text-center text-sm text-gray-500">
                        Memuat daftar rental...
                      </p>
                    ) : rentals.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500 dark:border-gray-700">
                        Belum ada data rental.
                      </p>
                    ) : (
                      <div className="space-y-3">
                      {rentals.map((rental) => (
  <div
    key={rental.id}
    className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800"
  >
    <img
      src={rental.image_url}
      alt={rental.name}
      className="h-16 w-16 shrink-0 rounded-xl object-cover"
    />

    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold">
        {rental.name}
      </p>
      <p className="truncate text-xs text-gray-500">
        {rental.region}
      </p>
      <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
        ◉ {Number(rental.total_views || 0).toLocaleString("id-ID")} Total Views
      </p>
      <p className="truncate text-xs text-gray-500">
        WhatsApp: {rental.whatsapp_number || "Belum diatur"}
      </p>
      {rental.subscription_expires_at && (
        <p className="truncate text-xs text-gray-500">
          Subscription sampai: {new Date(rental.subscription_expires_at).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" })}
        </p>
      )}
      <button
        type="button"
        onClick={() => openRentalInstagram(rental)}
        className="text-left text-xs font-semibold text-red-600"
      >
        Instagram ↗
      </button>
    </div>

    <div className="flex shrink-0 flex-col gap-2">
      <button
        type="button"
        onClick={() => handleEditRental(rental)}
        className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold dark:bg-gray-800"
      >
        Edit
      </button>

      <button
        type="button"
        onClick={() => void handleToggleRentalStatus(rental, "is_verified")}
        className={`rounded-lg px-3 py-2 text-xs font-bold ${
          rental.is_verified
            ? "bg-blue-100 text-blue-700"
            : "bg-gray-100 text-gray-500 dark:bg-gray-800"
        }`}
      >
        ✓ Partner Ship {rental.is_verified ? "ON" : "OFF"}
      </button>

      <button
        type="button"
        onClick={() => void handleToggleRentalStatus(rental, "is_subscription")}
        className={`rounded-lg px-3 py-2 text-xs font-bold ${
          rental.is_subscription_active
            ? "bg-yellow-100 text-yellow-800"
            : "bg-gray-100 text-gray-500 dark:bg-gray-800"
        }`}
      >
        ♛ Subscription {rental.is_subscription_active ? "AKTIF" : rental.is_subscription ? "KEDALUWARSA" : "OFF"}
      </button>

      <button
        type="button"
        onClick={() => void handleDeleteRental(rental)}
        className="rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-700"
      >
        Hapus
      </button>
    </div>
  </div>
))}
</div>
)}
</div>
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

        {/* MODAL UPLOAD EVENT */}
        {eventFormOpen && currentRole === "user" && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-5">
            <section className="my-auto max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:p-7">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-red-600">
                    Publikasikan kegiatan
                  </p>
                  <h2 className="mt-2 text-2xl font-black">
                    Upload Poster Event
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Event akan ditinjau admin sebelum tampil di halaman publik.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEventFormOpen(false);
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
                        required
                       onChange={(event) => {
  const file = event.target.files?.[0];

  if (file) {
    setPosterFile(null);
    setPosterPreview("");
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
                    defaultValue=""
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
                    defaultValue=""
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
                      defaultValue={"DKI Jakarta"}
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
                      defaultValue=""
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
                    defaultValue=""
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
                      defaultValue=""
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
                      defaultValue=""
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
                      defaultValue={"09:00"}
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
                      defaultValue={"18:00"}
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
                      defaultValue=""
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
                    defaultValue=""
                    placeholder="https://..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                  />
                </div>

                <div>
                  <label htmlFor="new-social-link" className="mb-1 block text-sm font-bold">
                    Link media sosial / informasi event (opsional)
                  </label>
                  <input
                    id="new-social-link"
                    type="url"
                    inputMode="url"
                    placeholder="https://instagram.com/... atau tautan lainnya"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Bisa berupa Instagram, TikTok, X, website, atau link informasi event.
                  </p>
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
                    Kirim Event
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
        {activeEventPreview && currentRole === "user" && (
          <div className={`pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4 ${eventPreviewClosing ? "animate-[previewFadeOut_0.14s_ease-in_forwards]" : "animate-[fadeIn_0.12s_ease-out]"}`}>
            <div className={`w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl dark:bg-gray-900 ${eventPreviewClosing ? "animate-[previewPopOut_0.14s_ease-in_forwards]" : "animate-[previewPopIn_0.16s_ease-out]"}`}>
              <div className="relative flex max-h-[58vh] items-center justify-center bg-gray-100 dark:bg-gray-950">
                {activeEventPreview.poster_url ? (
                  <img src={activeEventPreview.poster_url} alt={`Preview poster ${activeEventPreview.title}`} className="max-h-[58vh] w-full object-contain" />
                ) : (
                  <div className="flex aspect-[3/4] w-full items-center justify-center text-sm text-gray-500">Poster tidak tersedia</div>
                )}
              </div>
              <div className="space-y-2 p-4">
                <h3 className="line-clamp-2 text-base font-black">{activeEventPreview.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">📍 {activeEventPreview.venue_address || activeEventPreview.city}{activeEventPreview.province ? `, ${activeEventPreview.province}` : ""}</p>
                <p className="line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{activeEventPreview.description || "Belum ada deskripsi event."}</p>
                <p className="text-[10px] font-semibold text-red-600">Lepaskan jari atau tombol mouse untuk menutup preview</p>
              </div>
            </div>
          </div>
        )}

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

             <div className="flex flex-col items-center gap-1 text-center">
  <p className="text-xs text-gray-400">
    © {new Date().getFullYear()} NGIPEN
  </p>

  <p className="mt-2 text-xs font-semibold tracking-wide text-gray-600 dark:text-gray-300">
    MARI KITA COSPLAY
  </p>

  <p className="text-[11px] font-medium tracking-wider text-gray-400">
    MAKICOS ID
  </p>
</div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
