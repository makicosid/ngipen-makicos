
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import AdminCleanupPanel from "./admin-cleanup-panel";

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
  | "Market Event"
  | "Roleplay";
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
  organizer_avatar?: string;
  created_at: string;
}

interface Doc {
  id: string;
  event_id: string;
  user_id: string;
  display_name?: string;
  avatar_url?: string;
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

interface PublicProfile {
  id: string;
  display_name: string;
  avatar_url: string;
  bio: string;
  instagram_url: string;
  tiktok_url: string;
}

interface RegUser {
  id: string;
  username: string;
  password_hash?: string;
  display_name: string;
  bio?: string;
  avatar_url?: string;
  instagram_url?: string;
  tiktok_url?: string;
  created_at: string;
  savedEventsCount?: number;
  totalClicks?: number;
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
  "Performance",
  "Market",
  "Game",
  "Comic",
  "Roleplay",
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

function getCategoryLabel(category: string) {
  return category === "Pefomance" ? "Performance" : category;
}


const GUIDE_BOOK_PAGES = [
  {
    "title": "Sampul",
    "eyebrow": "WELCOME TO NGIPEN!",
    "paragraphs": [
      "Panduan kecil buat kamu yang ingin menjelajahi dunia event jejepangan dan menemukan berbagai kebutuhan cosplay."
    ],
    "bullets": [
      "Cari event • Pantau jadwal • Simpan favorit • Temukan rental costume",
      "LET'S EXPLORE AND HAVE FUN! ♥"
    ],
    "visual": "cover"
  },
  {
    "title": "Kenalan dengan NGIPEN",
    "eyebrow": "APA SIH NGIPEN ITU?",
    "paragraphs": [
      "NGIPEN adalah website informasi dan jadwal event jejepangan di seluruh Indonesia.",
      "Buat kamu yang suka cosplay, jejepangan, atau sekadar senang datang ke event, NGIPEN hadir supaya kamu lebih gampang menemukan berbagai kegiatan seru di sekitarmu maupun di kota lain.",
      "Di NGIPEN, kamu bisa:"
    ],
    "bullets": [
      "🔎 Cari berbagai event jejepangan.",
      "📅 Cek jadwal event berdasarkan tanggal.",
      "❤️ Simpan event yang menarik perhatianmu.",
      "🎭 Temukan informasi rental costume.",
      "📱 Jelajahi NGIPEN lewat HP maupun desktop.",
      "Jadi, nggak perlu bingung lagi mencari informasi event jejepangan!"
    ],
    "visual": "intro"
  },
  {
    "title": "Beranda NGIPEN",
    "eyebrow": "MULAI JELAJAHI DARI SINI!",
    "paragraphs": [
      "Saat membuka NGIPEN, kamu akan menemukan beberapa bagian yang bisa membantu perjalananmu mencari event dan kebutuhan cosplay.",
      "Kenalan dulu dengan bagian-bagian beranda:"
    ],
    "bullets": [
      "Pilihan Partner — tempat melihat partner pilihan NGIPEN.",
      "Event Promote — kumpulan event yang sedang dipromosikan.",
      "Jelajahi Event — tempat mencari berbagai event jejepangan.",
      "Cari Costume — akses untuk menemukan daftar rental cosplay.",
      "Kalender Event — lihat jadwal event berdasarkan tanggal.",
      "Yuk, mulai jelajahi dan temukan event yang cocok buat kamu!"
    ],
    "visual": "home"
  },
  {
    "title": "Jelajahi Event",
    "eyebrow": "LAGI CARI EVENT? ADA DI SINI!",
    "paragraphs": [
      "Mau cari event di kotamu atau penasaran dengan event di daerah lain? Langsung saja buka menu Jelajahi Event!",
      "Supaya pencarianmu lebih gampang, kamu bisa menggunakan beberapa fitur berikut:"
    ],
    "bullets": [
      "Cari event berdasarkan nama atau informasinya.",
      "Filter berdasarkan provinsi dan kota.",
      "Pilih kategori event: Cosplay, Performance, Market, Game, Comic, dan Roleplay.",
      "Gunakan filter jenis tiket jika tersedia.",
      "Urutkan event berdasarkan Terbaru atau Terpopuler.",
      "Lihat event pada minggu ini",
      "Lihat event berdasarkan status Upcoming, Ongoing, atau Completed.",
      "Tinggal atur pencarian sesuai keinginanmu, lalu temukan event yang ingin kamu kunjungi!"
    ],
    "visual": "explore"
  },
  {
    "title": "Kalender Event",
    "eyebrow": "JANGAN SAMPAI SALAH TANGGAL EVENT!",
    "paragraphs": [
      "Kalender Event membantu kamu melihat event berdasarkan tanggal yang dipilih.",
      "Cara menggunakannya gampang banget:"
    ],
    "bullets": [
      "1. Login terlebih dahulu sebagai User, daftar jika belum punya.",
      "2. Buka menu Kalender melalui menu atau tombol Buka Kalender Event.",
      "3. Pilih tanggal yang ingin kamu cek.",
      "4. Lihat daftar event pada tanggal tersebut.",
      "5. Pilih event yang menarik untuk membuka Detail Event.",
      "6. Mau kembali ke kalender? Gunakan tombol kembali.",
      "Sekarang kamu bisa lebih mudah merencanakan event mana yang ingin dikunjungi!"
    ],
    "visual": "calendar"
  },
  {
    "title": "Preview & Detail Event",
    "eyebrow": "KEPO SAMA DETAIL EVENT? INTIP DULU!",
    "paragraphs": [
      "Sebelum membuka informasi lengkap, kamu bisa menggunakan fitur Hold-to-Preview pada kartu event.",
      "Caranya:"
    ],
    "bullets": [
      "Di HP, tekan dan tahan kartu event.",
      "Di desktop, klik dan tahan kartu event.",
      "Tunggu beberapa saat sampai preview poster muncul.",
      "Lepaskan sentuhan atau tombol mouse untuk menutup preview.",
      "Kalau ingin tahu informasi lebih lengkap, buka Detail Event. Di halaman ini kamu bisa melihat informasi seperti poster, lokasi, jadwal, dan deskripsi event."
    ],
    "visual": "preview"
  },
  {
    "title": "Simpan & Interaksi Event",
    "eyebrow": "EVENT MENARIK? SIMPAN DULU!",
    "paragraphs": [
      "Kadang menemukan banyak event menarik sekaligus, sampai takut lupa event mana yang ingin dikunjungi.",
      "Tenang, kamu bisa menggunakan fitur simpan event setelah login sebagai User."
    ],
    "bullets": [
      "Simpan event favorit agar lebih mudah ditemukan lagi melalui tab Tersimpan.",
      "Berikan rating untuk event.",
      "Tulis komentar dan lihat komentar dari pengguna lain.",
      "Unggah dokumentasi event jika fitur tersebut tersedia pada Detail Event.",
      "Jadi, kamu nggak perlu repot mencari ulang event yang sudah menarik perhatianmu!"
    ],
    "visual": "saved"
  },
  {
    "title": "Publikasikan Event",
    "eyebrow": "PUNYA INFORMASI EVENT? YUK, BAGIKAN!",
    "paragraphs": [
      "Kalau kamu punya informasi event jejepangan yang ingin dibagikan, kamu bisa menggunakan fitur Upload Event.",
      "Caranya:"
    ],
    "bullets": [
      "1. Login sebagai User.",
      "2. Pilih menu Upload Event atau Publikasikan Event.",
      "3. Lengkapi informasi event yang diminta.",
      "4. Unggah poster event.",
      "5. Kirim informasi untuk masuk ke proses moderasi.",
      "Setelah dikirim, event akan melalui proses pemeriksaan terlebih dahulu sebelum bisa ditampilkan sebagai event yang disetujui.",
      "Dengan begitu, informasi event jejepangan bisa semakin mudah ditemukan oleh komunitas!",
      "Catatan: Saat ini User belum memiliki fitur untuk mengedit event yang sudah dikirim."
    ],
    "visual": "publish"
  },
  {
    "title": "Cari Costume",
    "eyebrow": "LAGI CARI COSTUME BUAT EVENT?",
    "paragraphs": [
      "Nggak cuma informasi event, NGIPEN juga punya fitur untuk membantu kamu menemukan rental costume cosplay.",
      "Melalui menu Cari Costume, kamu bisa menjelajahi daftar rental yang tersedia di NGIPEN.",
      "Di sini kamu bisa:"
    ],
    "bullets": [
      "Melihat berbagai toko rental cosplay.",
      "Mengetahui nama rental.",
      "Melihat lokasi atau domisili rental.",
      "Mengunjungi Instagram penyedia rental.",
      "Menemukan pilihan rental sesuai informasi yang tersedia.",
      "Siapa tahu costume yang selama ini kamu cari ternyata ada di salah satu rental yang terdaftar!"
    ],
    "visual": "rental"
  },
  {
    "title": "Daftar Rentalan (Partner Ship Makicos)",
    "eyebrow": "KENALAN DENGAN PARTNER SHIP MAKICOS!",
    "paragraphs": [
      "Partner Ship Makicos merupakan halaman yang menampilkan daftar rental cosplay yang terdaftar di NGIPEN.",
      "Setiap rental memiliki informasi supaya kamu lebih mudah mengenali dan menemukan penyedianya.",
      "Informasi yang bisa kamu lihat:"
    ],
    "bullets": [
      "Foto atau Logo Rental — identitas rental",
      "Nama Rental — nama usaha penyedia rental.",
      "Domisili — informasi provinsi dan kota rental.",
      "Instagram — link menuju profile Instagram rental.",
      "Cara melihat daftar rental:",
      "1. Login sebagai User.",
      "2. Buka menu Cari Costume melalui navigasi atau hamburger menu.",
      "3. Masuk ke halaman Partner Ship Makicos.",
      "4. Pilih rental yang ingin kamu lihat.",
      "5. Klik tautan Instagram untuk mengunjungi akun rental tersebut.",
      "Gampang, kan? Sekarang kamu bisa mulai mencari rental costume yang sesuai kebutuhanmu!"
    ],
    "visual": "rental"
  },
  {
    "title": "Penambahan Daftar Rentalan",
    "eyebrow": "BAGAIMANA CARA RENTAL MASUK KE NGIPEN?",
    "paragraphs": [
      "Punya usaha rental costume dan ingin masuk ke daftar Partner Ship Makicos?",
      "Saat ini, penambahan dan pengelolaan daftar rental hanya bisa dilakukan oleh Admin melalui menu Konfigurasi List Rentalan di Panel Admin.",
      "Data yang dibutuhkan untuk menambahkan rental:"
    ],
    "bullets": [
      "Informasi — Keterangan",
      "Foto / Logo — Gambar persegi dengan rasio 1:1",
      "Nama Rental — Nama usaha rental",
      "Domisili — Provinsi dan kota",
      "Instagram — Tautan akun Instagram rental",
      "Admin juga bisa melakukan beberapa pengelolaan:",
      "Menambahkan rental baru.",
      "Mengganti foto atau logo.",
      "Mengubah nama rental.",
      "Memperbarui domisili.",
      "Mengganti tautan Instagram.",
      "Menghapus rental dari daftar.",
      "Catatan: Penambahan dan perubahan data rental hanya bisa dilakukan oleh Admin, bukan melalui formulir pendaftaran mandiri di halaman publik."
    ],
    "visual": "admin"
  },
  {
    "title": "Menghubungi Rental",
    "eyebrow": "SUDAH MENEMUKAN RENTAL YANG COCOK?",
    "paragraphs": [
      "Kalau sudah menemukan rental yang kamu cari, sekarang waktunya menghubungi penyedianya!",
      "Gunakan tautan kontak yang tersedia pada informasi rental."
    ],
    "bullets": [
      "Klik Instagram untuk melihat profil rental.",
      "Jika tersedia, gunakan WhatsApp untuk menghubungi penyedia.",
      "Tanyakan ketersediaan costume yang kamu inginkan.",
      "Pastikan harga, jadwal sewa, dan ketentuan rental langsung kepada penyedia.",
      "Jangan lupa cek informasi dan ketentuan rental sebelum melakukan pemesanan, ya!"
    ],
    "visual": "contact"
  },
  {
    "title": "Guest, User & Akun",
    "eyebrow": "GUEST ATAU USER, KAMU TERMASUK YANG MANA?",
    "paragraphs": [
      "Di NGIPEN, kamu bisa menjelajahi website sebagai Guest atau login sebagai User.",
      "Guest — Cocok buat kamu yang ingin melihat informasi publik tanpa login.",
      "User — Dengan login, kamu bisa mengakses fitur tambahan seperti:"
    ],
    "bullets": [
      "Kalender Event.",
      "Simpan Event.",
      "Rating dan komentar.",
      "Upload Event.",
      "Cari Costume.",
      "Cara masuk ke akun:",
      "Pilih menu Login.",
      "Masukkan username Instagram dan password.",
      "Setelah berhasil, kamu bisa mulai menggunakan fitur User.",
      "Kamu juga bisa mengelola informasi profil melalui menu akun. Kalau sudah selesai, pilih Keluar untuk logout."
    ],
    "visual": "account"
  },
  {
    "title": "Panduan HP & Desktop",
    "eyebrow": "NGIPEN BISA DIBUKA DI MANA SAJA!",
    "paragraphs": [
      "Mau buka NGIPEN lewat HP atau laptop? Keduanya bisa digunakan! Hanya saja, posisi menu dan cara menggunakannya sedikit berbeda.",
      "Kalau menggunakan HP:"
    ],
    "bullets": [
      "Tekan tombol hamburger (☰) untuk membuka navigasi.",
      "Sentuh kartu event untuk membuka informasinya.",
      "Gulir halaman untuk melihat bagian lainnya.",
      "Gunakan sentuhan dan tahan untuk Hold-to-Preview.",
      "Kalau menggunakan Desktop:",
      "Gunakan navigasi yang tersedia di bagian atas halaman.",
      "Klik kartu event untuk membuka informasinya.",
      "Klik dan tahan kartu untuk Hold-to-Preview.",
      "Gulir halaman menggunakan mouse atau touchpad.",
      "Tampilan akan menyesuaikan ukuran layar perangkatmu, jadi kamu tetap bisa menjelajahi NGIPEN dengan nyaman!"
    ],
    "visual": "devices"
  },
  {
    "title": "Bantuan & Customer Service",
    "eyebrow": "BUTUH BANTUAN? JANGAN SUNGKAN HUBUNGI KAMI!",
    "paragraphs": [
      "Kalau kamu mengalami kendala saat menggunakan NGIPEN atau ingin bertanya mengenai website, kamu bisa menghubungi Customer Service kami.",
      "CUSTOMER SERVICE NGIPEN",
      "WhatsApp: 0881011676184",
      "https://wa.me/62881011676184",
      "Jangan lupa jelaskan kendala atau pertanyaanmu supaya tim kami bisa membantu dengan lebih mudah.",
      "TERIMA KASIH SUDAH MENJADI BAGIAN DARI NGIPEN!",
      "Sampai bertemu di event jejepangan berikutnya! 🎌"
    ],
    "bullets": [],
    "visual": "support"
  }
];


const GUIDE_MOBILE_ILLUSTRATIONS = [
  "/ngipen-guidebook-chibi/guide-01.webp",
  "/ngipen-guidebook-chibi/guide-02.webp",
  "/ngipen-guidebook-chibi/guide-03.webp",
  "/ngipen-guidebook-chibi/guide-04.webp",
  "/ngipen-guidebook-chibi/guide-05.webp",
  "/ngipen-guidebook-chibi/guide-06.webp",
  "/ngipen-guidebook-chibi/guide-07.webp",
  "/ngipen-guidebook-chibi/guide-08.webp",
  "/ngipen-guidebook-chibi/guide-09.webp",
  "/ngipen-guidebook-chibi/guide-10.webp",
  "/ngipen-guidebook-chibi/guide-11.webp",
  "/ngipen-guidebook-chibi/guide-12.webp",
  "/ngipen-guidebook-chibi/guide-13.webp",
  "/ngipen-guidebook-chibi/guide-14.webp",
  "/ngipen-guidebook-chibi/guide-15.webp",
];

const GUIDE_SCREENSHOTS: Record<number, { src: string; caption: string }> = {
  2: { src: "/guidebook/beranda.webp", caption: "Contoh tampilan beranda NGIPEN." },
  3: { src: "/guidebook/jelajahi-event.webp", caption: "Contoh daftar event, kolom pencarian, filter, dan tombol Reset Filter." },
  4: { src: "/guidebook/kalender.webp", caption: "Contoh Kalender Event dan daftar event berdasarkan tanggal." },
  5: { src: "/guidebook/detail-event.webp", caption: "Contoh halaman Detail Event, rating, komentar, dan dokumentasi." },
  6: { src: "/guidebook/event-tersimpan.webp", caption: "Contoh tab Tersimpan pada Jelajahi Event." },
  7: { src: "/guidebook/upload-event.webp", caption: "Contoh formulir untuk memublikasikan poster dan informasi event." },
  9: { src: "/guidebook/rental-costume.webp", caption: "Contoh halaman Partner Ship Makicos dan daftar rental costume." },
  12: { src: "/guidebook/daftar-akun.webp", caption: "Contoh formulir pendaftaran akun User." },
};

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
  const [showGuideBook, setShowGuideBook] = useState(false);
  const [guidePage, setGuidePage] = useState(0);

  useEffect(() => {
    if (!showGuideBook) return;
    const handleGuideKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowGuideBook(false);
      if (event.key === "ArrowRight") {
        setGuidePage((page) => Math.min(GUIDE_BOOK_PAGES.length - 1, page + 1));
      }
      if (event.key === "ArrowLeft") {
        setGuidePage((page) => Math.max(0, page - 1));
      }
    };
    window.addEventListener("keydown", handleGuideKey);
    return () => window.removeEventListener("keydown", handleGuideKey);
  }, [showGuideBook]);


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
  const [activeNav, setActiveNav] = useState<"home" | "explore" | "costume" | "calendar" | "guide">("home");
  const activeNavHistoryRef = useRef<"home" | "explore" | "costume" | "calendar" | "guide">("home");
  const suppressActiveNavHistoryRef = useRef(false);
  const activeNavHistoryReadyRef = useRef(false);
  // Jumlah entri navigasi internal NGIPEN yang aman untuk dikembalikan.
  const ngipenHistoryDepthRef = useRef(0);
  const [isMobileCalendar, setIsMobileCalendar] = useState(false);

useEffect(() => {
  const checkScreenSize = () => {
    setIsMobileCalendar(window.innerWidth < 640);
    setEventsPerPage(window.innerWidth >= 1024 ? 16 : 8);
  };

  checkScreenSize();
  window.addEventListener("resize", checkScreenSize);

  return () => window.removeEventListener("resize", checkScreenSize);
}, []);

useEffect(() => {
  setCurrentEventPage(1);
}, [eventsPerPage]);
const [calendarMonth, setCalendarMonth] = useState(new Date());
const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
const [eventStatusTab, setEventStatusTab] = useState<
  "Semua" | "Upcoming" | "Ongoing" | "Completed"
>("Semua");

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
const eventOpenSourceRef = useRef<"calendar" | "explore" | "other">("explore");
const calendarScrollYRef = useRef(0);
// Browser history entry khusus untuk detail event yang dibuka di dalam halaman utama.
// Ini membuat swipe-back Chrome Android dan tombol Back Android menutup detail,
// bukan keluar dari NGIPEN.
const eventHistoryEntryRef = useRef(false);
const eventPreviousScrollYRef = useRef(0);
const eventPreviousActiveNavRef = useRef<"home" | "explore" | "costume" | "calendar" | "guide">("home");
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

const pushEventHistoryEntry = (event: Event) => {
  if (typeof window === "undefined") return;

  const currentUrl = new URL(window.location.href);
  // Link berbagi ?event=<id> sudah merupakan entri halaman tersendiri.
  // Jangan menambahkan entri kedua saat detail dibuka otomatis dari tautan tersebut.
  if (currentUrl.searchParams.get("event") === String(event.id)) return;

  eventPreviousScrollYRef.current = window.scrollY;
  currentUrl.searchParams.set("event", String(event.id));
  window.history.pushState(
    {
      ...(window.history.state || {}),
      __ngipenEventDetail: true,
      ngipenEventId: String(event.id),
    },
    "",
    `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
  );
  eventHistoryEntryRef.current = true;
  ngipenHistoryDepthRef.current += 1;
};

const closeEventDetailWithHistory = () => {
  if (eventHistoryEntryRef.current) {
    window.history.back();
    return;
  }

  setSelectedEvent(null);
  sharedEventOpenedRef.current = null;
  eventOpenSourceRef.current = "explore";
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete("event");
  window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
};

useEffect(() => {
  const handleBrowserBack = (event: PopStateEvent) => {
    ngipenHistoryDepthRef.current = Math.max(0, ngipenHistoryDepthRef.current - 1);
    const previousView = event.state?.__ngipenAppView;

    if (eventHistoryEntryRef.current) {
      eventHistoryEntryRef.current = false;
      setSelectedEvent(null);
      sharedEventOpenedRef.current = null;
      setShowCostumeDirectory(false);

      const restoreView =
        previousView === "home" || previousView === "explore" || previousView === "costume" || previousView === "calendar" || previousView === "guide"
          ? previousView
          : eventPreviousActiveNavRef.current;
      if (activeNavHistoryRef.current !== restoreView) {
        suppressActiveNavHistoryRef.current = true;
      }
      activeNavHistoryRef.current = restoreView;
      setActiveNav(restoreView);
      setShowCalendar(restoreView === "calendar");
      setShowCostumeDirectory(restoreView === "costume");

      // Browser memulihkan entri history; pulihkan juga posisi scroll tampilan asal.
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: eventPreviousScrollYRef.current, left: 0, behavior: "auto" });
      });
      return;
    }

    // Navigasi tab internal juga menjadi entri history, sehingga swipe-back
    // dapat kembali dari Kalender/Costume/Jelajahi ke tampilan sebelumnya.
    if (previousView === "home" || previousView === "explore" || previousView === "costume" || previousView === "calendar" || previousView === "guide") {
      if (activeNavHistoryRef.current !== previousView) {
        suppressActiveNavHistoryRef.current = true;
      }
      activeNavHistoryRef.current = previousView;
      setActiveNav(previousView);
      setShowCalendar(previousView === "calendar");
      setShowCostumeDirectory(previousView === "costume");
      setSelectedEvent(null);
    }
  };

  // Tandai entri awal halaman tanpa menambah langkah navigasi.
  const currentState = window.history.state || {};
  const restoredView = currentState.__ngipenAppView;
  if (restoredView === "home" || restoredView === "explore" || restoredView === "costume" || restoredView === "calendar" || restoredView === "guide") {
    if (activeNavHistoryRef.current !== restoredView) {
      suppressActiveNavHistoryRef.current = true;
    }
    activeNavHistoryRef.current = restoredView;
    setActiveNav(restoredView);
    setShowCalendar(restoredView === "calendar");
    setShowCostumeDirectory(restoredView === "costume");
  } else {
    window.history.replaceState(
      { ...currentState, __ngipenAppView: activeNavHistoryRef.current },
      "",
      window.location.href
    );
  }

  window.addEventListener("popstate", handleBrowserBack);
  return () => window.removeEventListener("popstate", handleBrowserBack);
}, []);

useEffect(() => {
  // Aba pertama hanya menyelaraskan referensi; jangan membuat entri history saat mount.
  if (!activeNavHistoryReadyRef.current) {
    activeNavHistoryReadyRef.current = true;
    activeNavHistoryRef.current = activeNav;
    return;
  }

  if (suppressActiveNavHistoryRef.current) {
    suppressActiveNavHistoryRef.current = false;
    activeNavHistoryRef.current = activeNav;
    return;
  }

  if (activeNavHistoryRef.current === activeNav) return;

  activeNavHistoryRef.current = activeNav;
  window.history.pushState(
    { ...(window.history.state || {}), __ngipenAppView: activeNav },
    "",
    window.location.href
  );
  ngipenHistoryDepthRef.current += 1;
}, [activeNav]);

// Kedua arah swipe horizontal diperlakukan sebagai BACK.
// Gestur vertikal, kontrol form, carousel, dan area horizontal-scroll dikecualikan.
useEffect(() => {
  let startX = 0;
  let startY = 0;
  let startTarget: EventTarget | null = null;
  let tracking = false;

  const isExcludedTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return true;
    return Boolean(
      target.closest(
        'input, textarea, select, button, a, [role="button"], [contenteditable="true"], [data-swipe-ignore], .swiper, .carousel, [data-carousel], [data-horizontal-scroll]'
      )
    );
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      tracking = false;
      return;
    }
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startTarget = event.target;
    tracking = !isExcludedTarget(startTarget);
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (!tracking || event.changedTouches.length !== 1) return;
    tracking = false;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const horizontalDistance = Math.abs(deltaX);

    // Ambang gerak untuk membedakan swipe dari tap atau scroll vertikal.
    if (horizontalDistance < 85 || horizontalDistance < Math.abs(deltaY) * 1.35) return;

    // Jangan keluar dari NGIPEN jika tidak ada entri internal untuk dikembalikan.
    if (ngipenHistoryDepthRef.current > 0) {
      window.history.back();
    }
  };

  const handleTouchCancel = () => {
    tracking = false;
  };

  document.addEventListener("touchstart", handleTouchStart, { passive: true });
  document.addEventListener("touchend", handleTouchEnd, { passive: true });
  document.addEventListener("touchcancel", handleTouchCancel, { passive: true });
  return () => {
    document.removeEventListener("touchstart", handleTouchStart);
    document.removeEventListener("touchend", handleTouchEnd);
    document.removeEventListener("touchcancel", handleTouchCancel);
  };
}, []);

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
  const [editingApprovedEvent, setEditingApprovedEvent] = useState<Event | null>(null);
  const [adminEditDraft, setAdminEditDraft] = useState<Partial<Event>>({});
  const [adminEditCategories, setAdminEditCategories] = useState<Category[]>([]);
  const [adminEditPoster, setAdminEditPoster] = useState<File | null>(null);
  const [adminEditPosterPreview, setAdminEditPosterPreview] = useState("");
  const [adminEditSaving, setAdminEditSaving] = useState(false);

  // Buka Kalender setelah halaman selesai scroll ke posisi paling atas.
  const openCalendarFromNavigation = async () => {
    setMobileOpen(false);

    if (window.scrollY > 8) {
      await new Promise<void>((resolve) => {
        const startedAt = Date.now();
        let stableTopFrames = 0;

        const checkScrollPosition = () => {
          if (window.scrollY <= 2) {
            stableTopFrames += 1;
          } else {
            stableTopFrames = 0;
          }

          if (stableTopFrames >= 2 || Date.now() - startedAt >= 1800) {
            resolve();
            return;
          }

          window.requestAnimationFrame(checkScrollPosition);
        };

        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
        window.requestAnimationFrame(checkScrollPosition);
      });
    }

    setSelectedEvent(null);
    setShowCostumeDirectory(false);
    setShowCalendar(true);
    setCalendarMonth(new Date());
    setSelectedCalendarDate("");
    setActiveNav("calendar");

    setToast("✓ Kalender berhasil dibuka!");
    window.setTimeout(() => setToast(""), 2500);
  };
  const [logoClicks, setLogoClicks] = useState(0);

  const [registeredUsers, setRegisteredUsers] = useState<RegUser[]>([]);
  const [usersLoadError, setUsersLoadError] = useState("");
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersLoadError, setAdminUsersLoadError] = useState("");
  const [savedEventsUser, setSavedEventsUser] = useState<RegUser | null>(null);
  const [savedEventsList, setSavedEventsList] = useState<{ savedAt: string; event: Event }[]>([]);
  const [savedEventsLoading, setSavedEventsLoading] = useState(false);
  const [savedEventsError, setSavedEventsError] = useState("");
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [adminUserSort, setAdminUserSort] = useState<"Terbaru" | "Terlama" | "Klik terbanyak" | "Event tersimpan terbanyak">("Terbaru");
  const [adminUserPage, setAdminUserPage] = useState(1);
  const [adminUsersPerPage, setAdminUsersPerPage] = useState(10);
  const [selectedAdminUser, setSelectedAdminUser] = useState<RegUser | null>(null);

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedReviewerProfile, setSelectedReviewerProfile] = useState<PublicProfile | null>(null);
  const [reviewerProfileLoading, setReviewerProfileLoading] = useState(false);
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [docs, setDocs] = useState<Doc[]>([]);

  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [posterPreview, setPosterPreview] = useState("");
  const [posterError, setPosterError] = useState("");
  const [posterFile, setPosterFile] = useState<File | null>(null);

  const [newCategories, setNewCategories] = useState<Category[]>(["Cosplay"]);
  const [newTicketType, setNewTicketType] = useState<TicketType>("Gratis");

 const [adminTab, setAdminTab] =
    useState<"moderation" | "users" | "rentals" | "cleanup">("moderation");
  const [adminEventTab, setAdminEventTab] = useState<
    "Pending" | "Approved" | "Rejected" | "Sponsored" | "Completed" | "Hidden"
  >("Pending");
  const [adminEventSearch, setAdminEventSearch] = useState("");
  const [adminEventCategoryFilter, setAdminEventCategoryFilter] = useState("Semua");
  const [adminEventProvinceFilter, setAdminEventProvinceFilter] = useState("Semua");
  const [adminEventSponsorFilter, setAdminEventSponsorFilter] = useState<"Semua" | "Sponsor" | "Non-Sponsor">("Semua");
  const [selectedPendingEventIds, setSelectedPendingEventIds] = useState<string[]>([]);
  const [bulkApproveLoading, setBulkApproveLoading] = useState(false);
  const [selectedDeleteEventIds, setSelectedDeleteEventIds] = useState<string[]>([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
// Data Cari Costume
const [showCostumeDirectory, setShowCostumeDirectory] = useState(false);
const activeNavKey = selectedEvent
  ? (eventOpenSourceRef.current === "calendar" ? "calendar" : "explore")
  : showCalendar ? "calendar" : showCostumeDirectory ? "costume" : showGuideBook ? "guide" : activeNav;
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
  rentalProvince.trim() + ", " + rentalCity.trim();

formData.append("region", regionValue);
formData.append("province", rentalProvince.trim());
formData.append("city", rentalCity.trim());;
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

  const openUserSavedEvents = async (user: RegUser) => {
    setSavedEventsUser(user);
    setSavedEventsList([]);
    setSavedEventsError("");
    setSavedEventsLoading(true);

    try {
      const response = await fetch(
        `/api/admin-users/saved-events?userId=${encodeURIComponent(user.id)}`,
        { method: "GET", credentials: "include", cache: "no-store" }
      );
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.savedEvents)) {
        throw new Error(result.error || "Gagal memuat event tersimpan.");
      }
      setSavedEventsList(result.savedEvents as { savedAt: string; event: Event }[]);
    } catch (error) {
      console.error("Admin saved events load error:", error);
      setSavedEventsError(
        error instanceof Error ? error.message : "Gagal memuat event tersimpan."
      );
    } finally {
      setSavedEventsLoading(false);
    }
  };

  // Statistik pengguna khusus Admin — data dihitung oleh API server.
  useEffect(() => {
    if (currentRole !== "admin" || !showAdmin || adminTab !== "users") {
      return;
    }

    let active = true;

    const loadAdminUsers = async () => {
      setAdminUsersLoading(true);
      setAdminUsersLoadError("");

      try {
        const response = await fetch("/api/admin-users", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !Array.isArray(result.users)) {
          throw new Error(result.error || "Gagal memuat statistik pengguna.");
        }

        if (active) {
          setRegisteredUsers(result.users as RegUser[]);
          setUsersLoadError("");
        }
      } catch (error) {
        console.error("Admin users load error:", error);
        if (active) {
          setAdminUsersLoadError(
            error instanceof Error
              ? error.message
              : "Gagal memuat statistik pengguna."
          );
        }
      } finally {
        if (active) setAdminUsersLoading(false);
      }
    };

    void loadAdminUsers();

    return () => {
      active = false;
    };
  }, [currentRole, showAdmin, adminTab]);

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
     // Profil pengguna tidak lagi diambil dari public_users.
     // Data profil hanya dimuat dari endpoint sesi untuk pemilik akun.
     setUsersLoadError("");
        const eventsResponse = await fetch("/api/events", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const eventsResult = await eventsResponse.json();

        if (!eventsResponse.ok || !Array.isArray(eventsResult.events)) {
          throw new Error(
            eventsResult.error || "Gagal memuat data event."
          );
        }

        const eventsData = eventsResult.events as Event[];
        setEvents(eventsData);
        setSponsoredCount(
          eventsData.filter((event: any) => event.is_sponsored).length
        );

        const sessionResponse = await fetch("/api/auth", {
  method: "GET",
  credentials: "include",
  cache: "no-store",
});

const sessionResult = await sessionResponse.json();

// Hanya profil milik akun yang sedang login yang disimpan di state pengguna.
// Guest tidak memuat profil siapa pun.
if (sessionResponse.ok && sessionResult.user) {
  setRegisteredUsers([sessionResult.user as RegUser]);
} else {
  setRegisteredUsers([]);
}

const savedUserId =
  sessionResponse.ok && sessionResult.user
    ? String(sessionResult.user.id)
    : null;

        if (savedUserId) {
          const savesResponse = await fetch("/api/event-saves", {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });

          const savesResult = await savesResponse.json();

          if (savesResponse.ok && savesResult.success) {
            setSavedIds(savesResult.savedIds || []);
          } else {
            console.error(
              "Gagal memuat event tersimpan:",
              savesResult.error
            );
          }

        }

        const reviewsResponse = await fetch("/api/event-reviews", {
          method: "GET",
          cache: "no-store",
        });
        const reviewsResult = await reviewsResponse.json();

        if (!reviewsResponse.ok || !reviewsResult.success) {
          console.error("Gagal mengambil ulasan:", reviewsResult.error);
        } else {
          setMyRatings(reviewsResult.myRatings || {});
          // API publik hanya mengirim display_name dan avatar_url, tanpa username login.
          setReviews(reviewsResult.reviews || []);
        }

        const docsResponse = await fetch("/api/event-documentations", {
          method: "GET",
          cache: "no-store",
        });
        const docsResult = await docsResponse.json();

        if (docsResponse.ok && docsResult.success && Array.isArray(docsResult.docs)) {
          setDocs(docsResult.docs as Doc[]);
        } else {
          console.error(
            "Gagal memuat dokumentasi melalui API:",
            docsResult.error || "Respons API tidak valid."
          );

          // Tidak melakukan fallback langsung ke tabel Supabase dari browser.
          // Endpoint server adalah satu-satunya jalur untuk data dokumentasi publik.
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
    if (bucket !== "avatars") {
      throw new Error("Jenis unggahan tidak didukung.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/profile/avatar", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok || !result.success || typeof result.url !== "string") {
      throw new Error(result.error || "Gagal mengunggah avatar.");
    }

    const avatarUrl = new URL(result.url);
    avatarUrl.searchParams.set("v", String(Date.now()));
    return avatarUrl.toString();
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

      const savesResponse = await fetch("/api/event-saves", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const savesResult = await savesResponse.json();

      if (savesResponse.ok && savesResult.success) {
        setSavedIds(savesResult.savedIds || []);
      } else {
        console.error(
          "Gagal memuat event tersimpan setelah login:",
          savesResult.error
        );
      }

      setShowLoginUser(false);
      const loginNotices: string[] = [];
      if (result.passwordMigrationPending === true) {
        loginNotices.push(
          "Peningkatan keamanan password belum selesai. Coba ganti password dari menu profil."
        );
      }
      if (result.loginSecurityWarning === true) {
        loginNotices.push(
          "Pencatatan pembatasan login belum berhasil diperbarui; perlindungan percobaan login tetap aktif."
        );
      }

      setToast(
        loginNotices.length > 0
          ? `Login berhasil. ${loginNotices.join(" ")}`
          : `Halo, ${user.display_name || user.username}!`
      );
      setTimeout(() => setToast(""), loginNotices.length > 0 ? 6000 : 2000);
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
    setToast(
      result.loginSecurityWarning === true
        ? "Login admin berhasil, tetapi catatan pembatasan login belum dapat dibersihkan."
        : "Login admin berhasil."
    );
    setTimeout(() => setToast(""), result.loginSecurityWarning === true ? 5000 : 2000);
  } catch (error) {
    console.error("Admin login error:", error);
    setToast("Gagal menghubungi server.");
    setTimeout(() => setToast(""), 2000);
  }
};

 // Logout
const logout = async () => {
  const logoutErrors: string[] = [];

  try {
    const response = await fetch("/api/admin-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "logout" }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      logoutErrors.push(result?.error || "Sesi admin mungkin belum berhasil dicabut.");
    }
  } catch (error) {
    console.error("Admin logout error:", error);
    logoutErrors.push("Tidak dapat memastikan sesi admin telah dicabut.");
  }

  try {
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action: "logout" }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      logoutErrors.push(result?.error || "Sesi pengguna mungkin belum berhasil dicabut.");
    }
  } catch (error) {
    console.error("User logout error:", error);
    logoutErrors.push("Tidak dapat memastikan sesi pengguna telah dicabut.");
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

    setToast(
      logoutErrors.length > 0
        ? `Kamu telah keluar dari perangkat ini, tetapi ${logoutErrors.join(" ")}`
        : "Kamu telah keluar."
    );
    setTimeout(() => setToast(""), logoutErrors.length > 0 ? 5000 : 2000);
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
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("categories", JSON.stringify(newCategories));
      formData.append("province", province);
      formData.append("city", city);
      formData.append("venue_address", venue);
      formData.append("start_date", startDate);
      formData.append("end_date", endDate);
      formData.append("start_time", startTime);
      formData.append("end_time", endTime);
      formData.append("ticket_type", newTicketType);
      formData.append("ticket_url", ticketUrl || "");
      formData.append("registration_url", registrationUrl || "");
      formData.append("social_link", socialLink || "");
      formData.append("poster", posterFile);

      const response = await fetch("/api/events", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.event) {
        throw new Error(result.error || "Gagal menyimpan event.");
      }

      setEvents((prev) => [result.event as Event, ...prev]);
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

  const openApprovedEventEditor = (event: Event) => {
    setEditingApprovedEvent(event);
    // Normalisasi nilai time dari Supabase (HH:mm:ss) untuk input type=time.
    setAdminEditDraft({
      ...event,
      start_time: String(event.start_time || "09:00").slice(0, 5),
      end_time: String(event.end_time || "18:00").slice(0, 5),
    });
    setAdminEditCategories(
      (event.categories || [])
        .map((item) => item === "Pefomance" ? "Performance" : item)
        .filter((item) => eventCategoryOptions.some((option) => option === item)) as Category[]
    );
    setAdminEditPoster(null);
    setAdminEditPosterPreview(event.poster_url || "");
  };

  const handleAdminEditEvent = async () => {
    if (!editingApprovedEvent) return;
    if (adminEditCategories.length === 0) {
      setToast("Pilih minimal satu kategori event.");
      return;
    }
    setAdminEditSaving(true);
    try {
      const formData = new FormData();
      const fields = ["title", "description", "province", "city", "venue_address", "start_date", "end_date", "start_time", "end_time", "ticket_type", "ticket_url", "registration_url", "social_link"] as const;
      formData.append("id", editingApprovedEvent.id);
      fields.forEach((key) => formData.append(key, String(adminEditDraft[key] ?? "")));
      formData.append("categories", JSON.stringify(adminEditCategories));
      if (adminEditPoster) formData.append("poster", adminEditPoster);
      const response = await fetch("/api/admin/events/update", {
        method: "POST", credentials: "include", body: formData,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result.event) {
        throw new Error(result?.error || "Gagal menyimpan perubahan event.");
      }
      setEvents((prev) => prev.map((item) => item.id === editingApprovedEvent.id ? result.event as Event : item));
      setEditingApprovedEvent(null);
      setAdminEditPoster(null);
      setToast("Informasi event berhasil diperbarui. Status persetujuan dan sponsor tetap.");
    } catch (error) {
      setToast(`Gagal mengedit event: ${error instanceof Error ? error.message : "Terjadi kesalahan."}`);
    } finally {
      setAdminEditSaving(false);
      window.setTimeout(() => setToast(""), 4000);
    }
  };

  const handleBulkApprove = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      setToast("Pilih minimal satu event Pending.");
      setTimeout(() => setToast(""), 2500);
      return;
    }
    const confirmed = window.confirm(`Setujui ${uniqueIds.length} event Pending? Event akan disetujui tanpa mengaktifkan Sponsor.`);
    if (!confirmed) return;

    setBulkApproveLoading(true);
    try {
      const response = await fetch("/api/admin/events/bulk-approve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: uniqueIds }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Gagal menyetujui event secara massal.");
      }
      const updatedIds = new Set((result.updatedEvents || []).map((event: Event) => String(event.id)));
      setEvents((prev) => prev.map((event) => updatedIds.has(String(event.id)) ? { ...event, moderation_status: "Approved" as ModStatus } : event));
      setSelectedPendingEventIds([]);
      setToast(`${result.updated || 0} event berhasil disetujui. ${result.skipped || 0} dilewati karena statusnya sudah berubah.`);
    } catch (error) {
      setToast(`Bulk Approve gagal: ${error instanceof Error ? error.message : "Terjadi kesalahan."}`);
    } finally {
      setBulkApproveLoading(false);
      setTimeout(() => setToast(""), 4500);
    }
  };

  // Moderasi event dan penandaan sponsor melalui API server.
  const handleModeration = async (
    id: string,
    status: ModStatus,
    sponsor?: boolean,
    priority?: number
  ) => {
    try {
      const response = await fetch("/api/admin/events/moderation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, sponsor, priority }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.update) {
        throw new Error(result.error || "Gagal memperbarui event.");
      }

      setEvents((prev) =>
        prev.map((event) =>
          event.id === id ? { ...event, ...result.update } : event
        )
      );

      setToast(`Status event: ${status}`);
    } catch (error: any) {
      setToast(`Gagal memperbarui event: ${error.message}`);
    }

    setTimeout(() => setToast(""), 2500);
  };

  const handleBulkDelete = async (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      setToast("Pilih minimal satu event untuk dihapus.");
      window.setTimeout(() => setToast(""), 2500);
      return;
    }

    const confirmed = window.confirm(
      `Hapus ${uniqueIds.length} event Rejected (Ditolak) secara permanen? Event yang masih memiliki data terkait tidak akan dihapus. Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmed) return;

    setBulkDeleteLoading(true);
    try {
      const response = await fetch("/api/admin/events/bulk-delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: uniqueIds, target: "Rejected" }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Gagal menghapus event secara massal.");
      }

      const deletedIds = new Set((result.deletedIds || []).map((id: string) => String(id)));
      setEvents((prev) => prev.filter((event) => !deletedIds.has(String(event.id))));
      setSavedIds((prev) => prev.filter((id) => !deletedIds.has(String(id))));
      if (selectedEvent && deletedIds.has(String(selectedEvent.id))) setSelectedEvent(null);
      setSelectedDeleteEventIds([]);

      const blockedCount = Array.isArray(result.blocked) ? result.blocked.length : 0;
      const skippedCount = Number(result.skipped || 0);
      setToast(`${deletedIds.size} event berhasil dihapus. ${blockedCount} tertahan karena masih memiliki data terkait. ${skippedCount} dilewati karena status tidak sesuai atau sudah berubah.`);
    } catch (error) {
      setToast(`Bulk Delete gagal: ${error instanceof Error ? error.message : "Terjadi kesalahan."}`);
    } finally {
      setBulkDeleteLoading(false);
      window.setTimeout(() => setToast(""), 6000);
    }
  };

  // Hapus event yang sudah selesai secara permanen setelah konfirmasi admin.
  // Penghapusan dilakukan melalui API server agar sesi admin dan status Completed
  // diverifikasi kembali di server, bukan menghapus langsung dari browser.
  // Simpan atau hapus event dari daftar tersimpan
  const toggleSave = async (eventId: string) => {
    if (currentRole !== "user") {
      setShowLoginUser(true);
      return;
    }

    const isSaved = savedIds.includes(eventId);

    try {
      const response = await fetch("/api/event-saves", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action: isSaved ? "unsave" : "save",
          eventId,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setToast(
          result.error ||
            (isSaved
              ? "Gagal menghapus event tersimpan."
              : "Gagal menyimpan event.")
        );
        return;
      }

      if (isSaved) {
        setSavedIds((prev) =>
          prev.filter((id) => id !== eventId)
        );

        setEvents((prev) =>
          prev.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  saves_count: Math.max(
                    0,
                    event.saves_count - 1
                  ),
                }
              : event
          )
        );
      } else {
        setSavedIds((prev) =>
          prev.includes(eventId) ? prev : [...prev, eventId]
        );

        setEvents((prev) =>
          prev.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  saves_count: event.saves_count + 1,
                }
              : event
          )
        );
      }
    } catch (error) {
      console.error("Toggle save event error:", error);
      setToast("Gagal menghubungi server. Coba lagi.");
    }
  };

  const openReviewerProfile = async (userId: string) => {
    if (currentRole === "guest") {
      setShowLoginUser(true);
      return;
    }
    setReviewerProfileLoading(true);
    setSelectedReviewerProfile(null);
    try {
      const response = await fetch(`/api/public-profile?id=${encodeURIComponent(userId)}`, {
        method: "GET", credentials: "include", cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.profile) {
        throw new Error(result.error || "Gagal mengambil profil pengguna.");
      }
      setSelectedReviewerProfile(result.profile as PublicProfile);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Gagal mengambil profil pengguna.");
    } finally {
      setReviewerProfileLoading(false);
    }
  };

  // Penilaian event melalui API server
  const handleRate = async (eventId: string, rating: number) => {
    if (currentRole !== "user") {
      setShowLoginUser(true);
      return;
    }

    try {
      const response = await fetch("/api/event-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, rating }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal menyimpan rating.");
      }

      setMyRatings((prev) => ({ ...prev, [eventId]: rating }));
      if (typeof result.avg_rating === "number" && typeof result.rating_count === "number") {
        setEvents((prev) =>
          prev.map((event) =>
            String(event.id) === String(eventId)
              ? { ...event, avg_rating: result.avg_rating, rating_count: result.rating_count }
              : event
          )
        );
        setSelectedEvent((prev) =>
          prev && String(prev.id) === String(eventId)
            ? { ...prev, avg_rating: result.avg_rating, rating_count: result.rating_count }
            : prev
        );
      }
    } catch (error: any) {
      setToast(error.message || "Gagal menyimpan rating. Coba lagi.");
      setTimeout(() => setToast(""), 3000);
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
      const response = await fetch("/api/event-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: String(selectedEvent.id),
          rating: myRatings[selectedEvent.id] || undefined,
          comment: text,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal menyimpan ulasan.");
      }

      if (docFile && getTimeStatus(selectedEvent) === "Completed") {
        await handleUploadDoc();
      }

      const refreshResponse = await fetch(
        `/api/event-reviews?eventId=${encodeURIComponent(String(selectedEvent.id))}`,
        { method: "GET", cache: "no-store" }
      );
      const refreshResult = await refreshResponse.json();
      if (!refreshResponse.ok || !refreshResult.success) {
        throw new Error(refreshResult.error || "Ulasan tersimpan, tetapi daftar gagal diperbarui.");
      }

      const mapped = refreshResult.reviews || [];
      setReviews((prev) => [
        ...mapped,
        ...prev.filter((review) => String(review.event_id) !== String(selectedEvent.id)),
      ]);

      if (typeof refreshResult.myRatings?.[String(selectedEvent.id)] === "number") {
        setMyRatings((prev) => ({
          ...prev,
          [String(selectedEvent.id)]: refreshResult.myRatings[String(selectedEvent.id)],
        }));
      }
      if (typeof result.avg_rating === "number" && typeof result.rating_count === "number") {
        setEvents((prev) => prev.map((event) => String(event.id) === String(selectedEvent.id)
          ? { ...event, avg_rating: result.avg_rating, rating_count: result.rating_count }
          : event));
        setSelectedEvent((prev) => prev ? {
          ...prev,
          avg_rating: result.avg_rating,
          rating_count: result.rating_count,
        } : null);
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
      const formData = new FormData();
      formData.append("eventId", String(selectedEvent.id));
      formData.append("caption", docCaption);
      formData.append("file", docFile);

      const response = await fetch("/api/event-documentations", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.doc) {
        throw new Error(
          result.error || "Gagal mengunggah dokumentasi."
        );
      }

      setDocs((prev) => [result.doc as Doc, ...prev]);
      setDocFile(null);
      setDocCaption("");
      setToast("Dokumentasi berhasil diunggah.");
    } catch (error: any) {
      setToast(
        `Gagal mengunggah dokumentasi: ${
          error.message || "Terjadi kesalahan."
        }`
      );
    }

    setTimeout(() => setToast(""), 2500);
  };

  // Simpan perubahan profil user; gunakan username sebagai kunci stabil untuk menghindari konflik tipe id text/uuid.
 
  const handleUpdateUserProfile = async () => {
    const profileUser = registeredUsers.find(
      (user) => String(user.id) === String(currentUserId)
    );

    const displayName = (
      document.getElementById("edit-user-display") as HTMLInputElement
    )?.value?.trim();

    const bio = (
      document.getElementById("edit-user-bio") as HTMLTextAreaElement
    )?.value?.trim() || "";

    const instagramUrl = (document.getElementById("edit-user-instagram") as HTMLInputElement)?.value?.trim() || "";
    const tiktokUrl = (document.getElementById("edit-user-tiktok") as HTMLInputElement)?.value?.trim() || "";

    if (!displayName) {
      setToast("Nama profil wajib diisi.");
      return;
    }

    if (displayName.length > 50 || bio.length > 160) {
      setToast("Nama maksimal 50 karakter dan bio maksimal 160 karakter.");
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

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update_profile",
          displayName,
          bio,
          avatarUrl,
          instagramUrl,
          tiktokUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.user) {
        setToast(result.error || "Gagal menyimpan profil.");
        return;
      }

      const updated = result.user as RegUser;

      setRegisteredUsers((prev) => {
        const exists = prev.some(
          (user) => String(user.id) === String(updated.id)
        );

        return exists
          ? prev.map((user) =>
              String(user.id) === String(updated.id) ? updated : user
            )
          : [updated, ...prev];
      });

      setReviews((prev) =>
        prev.map((review) =>
          String(review.user_id) === String(updated.id)
            ? {
                ...review,
                display_name: updated.display_name,
                avatar_url: updated.avatar_url || "",
              }
            : review
        )
      );

      setCurrentUser(updated.display_name);
      setCurrentUserId(String(updated.id));

      localStorage.setItem("ngipen_user", updated.display_name);
      localStorage.setItem("ngipen_username", updated.username);
      localStorage.setItem("ngipen_user_id", String(updated.id));

      setUserAvatarFile(null);
      setShowUserProfile(false);
      setToast("Profil berhasil diperbarui.");

      setTimeout(() => setToast(""), 2000);
    } catch (error: any) {
      console.error("Update profile error:", error);
      setToast("Terjadi kesalahan saat menyimpan profil.");
    }
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

      const hasPasswordWarning =
        typeof result.warning === "string" && Boolean(result.warning.trim());
      setToast(
        hasPasswordWarning
          ? result.warning
          : "Password berhasil diganti."
      );

      if (oldInput) oldInput.value = "";
      if (newInput) newInput.value = "";

      setTimeout(() => setToast(""), hasPasswordWarning ? 5000 : 2000);
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
        event.categories?.some((category) =>
          selectedCat === "Performance"
            ? category === "Performance" || category === "Pefomance"
            : category === selectedCat
        )
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
        event.categories?.some((category) =>
          selectedCat === "Performance"
            ? category === "Performance" || category === "Pefomance"
            : category === selectedCat
        )
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

  useEffect(() => {
    setSelectedPendingEventIds([]);
    setSelectedDeleteEventIds([]);
  }, [adminEventTab, adminEventSearch, adminEventCategoryFilter, adminEventProvinceFilter, adminEventSponsorFilter]);

  const adminFilteredEvents = useMemo(() => {
    const query = adminEventSearch.trim().toLocaleLowerCase("id-ID");
    return events.filter((event) => {
      const completed = getTimeStatus(event) === "Completed";
      let matchesTab = false;

      if (adminEventTab === "Completed") {
        matchesTab = completed;
      } else if (!completed) {
        switch (adminEventTab) {
          case "Pending": matchesTab = event.moderation_status === "Pending"; break;
          case "Approved": matchesTab = event.moderation_status === "Approved" && !event.is_sponsored; break;
          case "Rejected": matchesTab = event.moderation_status === "Rejected"; break;
          case "Sponsored": matchesTab = event.moderation_status === "Approved" && event.is_sponsored; break;
          case "Hidden": matchesTab = event.moderation_status === "Hidden"; break;
        }
      }
      if (!matchesTab) return false;

      const searchable = [event.title, event.organizer_name, event.organizer_id, event.city, event.province, event.venue_address]
        .filter(Boolean).join(" ").toLocaleLowerCase("id-ID");
      if (query && !searchable.includes(query)) return false;
      if (adminEventCategoryFilter !== "Semua" && !(event.categories || []).some((category) => adminEventCategoryFilter === "Performance" ? category === "Performance" || category === "Pefomance" : category === adminEventCategoryFilter)) return false;
      if (adminEventProvinceFilter !== "Semua" && event.province !== adminEventProvinceFilter) return false;
      if (adminEventSponsorFilter === "Sponsor" && !event.is_sponsored) return false;
      if (adminEventSponsorFilter === "Non-Sponsor" && event.is_sponsored) return false;
      return true;
    });
  }, [events, adminEventTab, adminEventSearch, adminEventCategoryFilter, adminEventProvinceFilter, adminEventSponsorFilter, realTimeTick]);

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
  if ((currentRole !== "user" && currentRole !== "guest") || !pointerEvent.isPrimary || pointerEvent.button !== 0) return;
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
  eventPreviousActiveNavRef.current = activeNav;
  setActiveEventPreview(null);
  if (currentRole === "guest") {
    setPendingGuestEvent(event);
    setShowLoginUser(true);
    return;
  }

  pushEventHistoryEntry(event);
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

  // Ambil ulasan event melalui API server.
  try {
    const response = await fetch(
      `/api/event-reviews?eventId=${encodeURIComponent(String(event.id))}`,
      { method: "GET", cache: "no-store" }
    );
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Gagal mengambil ulasan event.");
    }

    const mapped = result.reviews || [];

    setReviews((prev) => [
      ...mapped,
      ...prev.filter((review) => String(review.event_id) !== String(event.id)),
    ]);
    if (typeof result.myRatings?.[String(event.id)] === "number") {
      setMyRatings((prev) => ({
        ...prev,
        [String(event.id)]: result.myRatings[String(event.id)],
      }));
    }
  } catch (error) {
    console.error("Gagal memuat ulasan event:", error);
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
        <header className="sticky top-0 z-40 border-b border-red-100 bg-white/95 backdrop-blur dark:border-red-950 dark:bg-gray-950/95">
          <div className="relative z-10 mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3">
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
  setActiveNav("home");
}}
                aria-current={activeNavKey === "home" ? "page" : undefined}
                className={`relative border-b-2 pb-2 text-sm font-semibold transition-colors duration-[250ms] ${activeNavKey === "home" ? "border-amber-400 text-amber-700 dark:text-amber-300" : "border-transparent hover:border-amber-300 hover:text-amber-600"}`}
              >
                Beranda
              </button>

              <button
  onClick={() => {
  setSelectedEvent(null);
  setShowCostumeDirectory(false);
  setShowCalendar(false);
  setUserTab("Semua");
  setActiveNav("explore");

  window.scrollTo({ top: 0, behavior: "smooth" });

  setTimeout(() => {
    document
      .getElementById("daftar-event")
      ?.scrollIntoView({ behavior: "smooth" });
  }, 200);
}}
  aria-current={activeNavKey === "explore" ? "page" : undefined}
  className={`relative border-b-2 pb-2 text-sm font-semibold transition-colors duration-[250ms] ${activeNavKey === "explore" ? "border-amber-400 text-amber-700 dark:text-amber-300" : "border-transparent hover:border-amber-300 hover:text-amber-600"}`}
>
  Jelajahi Event
</button>
{currentRole === "user" && (
                            <button
  onClick={() => {
    setSelectedEvent(null);
    setShowCostumeDirectory(true);
    setShowCalendar(false);
    setActiveNav("costume");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }}
  aria-current={activeNavKey === "costume" ? "page" : undefined}
  className={`relative border-b-2 pb-2 text-sm font-semibold transition-colors duration-[250ms] ${activeNavKey === "costume" ? "border-amber-400 text-amber-700 dark:text-amber-300" : "border-transparent hover:border-amber-300 hover:text-amber-600"}`}
>
  Cari Costume
</button>
)}
<button
  onClick={openCalendarFromNavigation}
  aria-current={activeNavKey === "calendar" ? "page" : undefined}
  className={`relative border-b-2 pb-2 text-sm font-semibold transition-colors duration-[250ms] ${activeNavKey === "calendar" ? "border-amber-400 text-amber-700 dark:text-amber-300" : "border-transparent hover:border-amber-300 hover:text-amber-600"}`}
>
  Kalender
</button>
              <button
                type="button"
                onClick={() => { setGuidePage(0); setShowGuideBook(true); }}
                aria-current={activeNavKey === "guide" ? "page" : undefined}
                className={`relative border-b-2 pb-2 text-sm font-semibold transition-colors duration-[250ms] ${activeNavKey === "guide" ? "border-amber-400 text-amber-700 dark:text-amber-300" : "border-transparent hover:border-amber-300 hover:text-amber-600"}`}
              >
                Buku Panduan
              </button>
              {currentRole !== "admin" && (
                <a
                  href="https://trakteer.id/makicos.id/tip"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Berikan Dukungan"
                  title="Berikan Dukungan"
                  className="text-sm font-semibold text-red-600 transition-colors hover:text-red-700"
                >
                  Berikan Dukungan ↗
                </a>
              )}
              {currentRole !== "admin" && (
              <button
                onClick={() => {
                  if (currentRole !== "user") {
                    setToast("Silakan login sebagai user terlebih dahulu.");
                    setShowLoginUser(true);
                    return;
                  }
                  setPosterFile(null);
                  setPosterPreview("");
                  setPosterError("");
                  setEventFormOpen(true);
                }}
                className="text-sm font-semibold text-red-600 hover:text-red-700"
              >
                + Upload Poster Event
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

              <a
                href="/tentang-kami"
                aria-label="Tentang Kami"
                title="Tentang Kami"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-red-600 transition hover:border-red-300 hover:bg-red-50 dark:border-gray-700 dark:hover:bg-red-950/30"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" />
                  <path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M8 7h8M8 10h8" />
                </svg>
              </a>

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
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Navigasi</p>
                  <button onClick={() => { setSelectedEvent(null); setShowCostumeDirectory(false); setShowCalendar(false); setMobileOpen(false); setUserTab("Semua"); setActiveNav("home"); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-current={activeNavKey === "home" ? "page" : undefined} className={`rounded-xl px-3 py-3 text-left font-semibold transition-colors ${activeNavKey === "home" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "hover:bg-gray-100 dark:hover:bg-gray-900"}`}>Beranda</button>
                  <button onClick={() => { setSelectedEvent(null); setShowCostumeDirectory(false); setShowCalendar(false); setMobileOpen(false); setUserTab("Semua"); setActiveNav("explore"); window.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => document.getElementById("daftar-event")?.scrollIntoView({ behavior: "smooth" }), 200); }} aria-current={activeNavKey === "explore" ? "page" : undefined} className={`rounded-xl px-3 py-3 text-left font-semibold transition-colors ${activeNavKey === "explore" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "hover:bg-gray-100 dark:hover:bg-gray-900"}`}>Jelajahi Event</button>
                  {currentRole === "user" && (
                  <button onClick={() => { setMobileOpen(false); setSelectedEvent(null); setShowCostumeDirectory(true); setShowCalendar(false); setActiveNav("costume"); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-current={activeNavKey === "costume" ? "page" : undefined} className={`rounded-xl px-3 py-3 text-left font-semibold transition-colors ${activeNavKey === "costume" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "hover:bg-gray-100 dark:hover:bg-gray-900"}`}>Cari Costume</button>
                  )}
                  <button onClick={() => { setMobileOpen(false); openCalendarFromNavigation(); }} aria-current={activeNavKey === "calendar" ? "page" : undefined} className={`rounded-xl px-3 py-3 text-left font-semibold transition-colors ${activeNavKey === "calendar" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "hover:bg-gray-100 dark:hover:bg-gray-900"}`}>Kalender</button>
                </div>
                <div className="border-t border-gray-200 pt-3 dark:border-gray-800">
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Informasi & Dukungan</p>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => { setMobileOpen(false); setGuidePage(0); setShowGuideBook(true); }} aria-current={activeNavKey === "guide" ? "page" : undefined} className="rounded-xl px-3 py-3 text-left font-semibold hover:bg-gray-100 dark:hover:bg-gray-900">Buku Panduan</button>
                    <a href="/tentang-kami" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 font-semibold hover:bg-gray-100 dark:hover:bg-gray-900">Tentang Kami</a>
                    {currentRole !== "admin" && (
                      <a
                        href="https://trakteer.id/makicos.id/tip"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-xl px-3 py-3 font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        Berikan Dukungan ↗
                      </a>
                    )}
                  </div>
                </div>
                {currentRole !== "admin" && (
                <div className="border-t border-gray-200 pt-3 dark:border-gray-800">
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Publikasi</p>
                  <button onClick={() => { setMobileOpen(false); if (currentRole !== "user") { setToast("Silakan login sebagai user terlebih dahulu."); setShowLoginUser(true); return; } setPosterFile(null); setPosterPreview(""); setPosterError(""); setEventFormOpen(true); }} className="w-full rounded-xl bg-red-600 px-3 py-3 text-left font-bold text-white shadow-sm transition hover:bg-red-700">＋ Upload Poster Event</button>
                </div>
                )}
                {currentRole === "admin" && <div className="border-t border-gray-200 pt-3 dark:border-gray-800"><button onClick={() => { setMobileOpen(false); setShowAdmin(true); }} className="w-full rounded-xl px-3 py-3 text-left font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">Panel Admin</button></div>}
                {currentRole !== "guest" && <button onClick={() => { setMobileOpen(false); logout(); }} className="rounded-xl px-3 py-3 text-left font-semibold hover:bg-gray-100 dark:hover:bg-gray-900">Keluar</button>}
              </div>
            </div>
          )}
        </header>

        {/* BERANDA */}
       {!selectedEvent && !showCostumeDirectory && (
          <main>
            {/* HERO */}
            <section className="mx-auto max-w-[1400px] px-4 pb-6 pt-8 sm:pt-10">
              <div className="ngipen-hero relative isolate overflow-hidden rounded-3xl border border-red-200/70 p-6 text-white shadow-[0_18px_50px_rgba(153,27,27,0.12)] sm:p-10 lg:p-12">
                <div className="relative z-10 grid items-center gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)] lg:gap-8">
                <div className="max-w-3xl">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-red-100">
                    Event Jejepangan Indonesia
                  </p>

                  <h1 className="text-3xl font-black leading-tight sm:text-5xl">
                    Your Next Event Starts Here!
                  </h1>

                  <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white sm:text-base">
                    Cari keseruannya, temukan teman se-hobi, dan buat cerita baru!
                  </p>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-red-50 sm:text-base">
                    Mulai dari cosplay, festival jejepangan, sampai gathering komunitas.
                    Temukan berbagai event seru dari seluruh Indonesia dan jangan sampai
                    ketinggalan keseruannya!
                  </p>

                  <p className="mt-3 text-xs font-bold tracking-wide text-red-100 sm:text-sm">
                    Satu hobby satu keseruan.
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
    Jelajahi Event
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
                <div className="ngipen-hero-mascots relative mx-auto flex h-[260px] w-full max-w-[440px] items-end justify-center lg:ml-auto lg:h-[340px]">
                  <span aria-hidden="true" className="absolute bottom-5 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
                  <img src="/mascots/kitsune-kun.png" alt="Kitsune-kun, maskot laki-laki NGIPEN" className="relative z-10 h-[94%] w-[52%] -mr-5 object-contain object-bottom drop-shadow-[0_12px_18px_rgba(80,0,0,.22)]" />
                  <img src="/mascots/kitsune-chan.png" alt="Kitsune-chan, maskot perempuan NGIPEN" className="relative z-20 h-full w-[56%] -ml-5 object-contain object-bottom drop-shadow-[0_12px_18px_rgba(80,0,0,.22)]" />
                  <span aria-hidden="true" className="absolute -right-1 top-2 z-30 text-3xl text-amber-200">✿</span>
                </div>
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
                      eventPreviousActiveNavRef.current = "calendar";
                      calendarScrollYRef.current = window.scrollY;
                      pushEventHistoryEntry(event);
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
  onClick={openCalendarFromNavigation}
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
              className="mx-auto w-full max-w-[1600px] scroll-mt-24 px-4 pb-12"
            >
              <div className="mb-5">
                <h2 className="text-2xl font-black sm:text-3xl">
                  Jelajahi Event
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Temukan kegiatan yang sesuai dengan minatmu.
                </p>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
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

                <button
                  type="button"
                  onClick={() => {
                    setSelectedProv("Semua");
                    setSelectedCity("Semua");
                    setSelectedCat("Semua");
                    setSelectedTicket("Semua");
                    setCurrentEventPage(1);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/60"
                  aria-label="Reset semua filter provinsi, kota, kategori, dan jenis tiket"
                >
                  <span aria-hidden="true" className="text-base">↺</span>
                  Reset Filter
                </button>
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
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 px-5 py-7 text-center text-sm text-gray-500 dark:border-gray-800">
                  <img src="/mascots/kitsune-kun.png" alt="Kitsune-kun sedang memuat" className="h-24 w-16 object-contain" />
                  <span>Memuat event...</span>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
                  <img src="/mascots/kitsune-chan.png" alt="Kitsune-chan sedang mencari event" className="h-28 w-20 object-contain" />
                  <p className="text-lg font-bold">Belum ada event ditemukan</p>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Coba ubah filter pencarian atau kunjungi kembali nanti.
                  </p>
                </div>
              ) : (
                <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-5">
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
{(showThisWeekOnly || eventStatusTab === "Upcoming" || eventStatusTab === "Ongoing") && (
  <span
    className={"absolute left-2 z-10 rounded-full px-2.5 py-1 text-[10px] font-black text-white shadow-md " + (event.is_sponsored ? "top-11 " : "top-2 ") + (
      showThisWeekOnly
        ? "bg-amber-500"
        : eventStatusTab === "Upcoming"
          ? "bg-red-600"
          : "bg-green-600"
    )}
  >
    {showThisWeekOnly
      ? "MINGGU INI"
      : eventStatusTab === "Upcoming"
        ? "UPCOMING"
        : "ONGOING"}
  </span>
)}

{getTimeStatus(event) === "Completed" && (
  <span className="absolute right-2 top-2 rounded-full bg-gray-800 px-2 py-1 text-[10px] font-black text-white">
    COMPLETED
  </span>
)}

                          <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-between gap-2">
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-sm md:px-3 md:py-1.5 md:text-sm ${
                                event.ticket_type === "Gratis"
                                  ? "bg-green-600"
                                  : "bg-red-600"
                              }`}
                            >
                              {event.ticket_type}
                            </span>
                            {(() => {
                              const start = new Date(event.start_date + "T00:00:00");
                              const end = new Date((event.end_date || event.start_date) + "T00:00:00");
                              const duration = Math.round(
                                (end.getTime() - start.getTime()) / 86400000
                              ) + 1;

                              if (duration < 1 || duration > 5) return null;

                              return (
                                <span className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white shadow-md md:text-[11px]">
                                  {duration}D
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="relative min-h-[174px] p-3 pb-14 lg:min-h-[190px]">
                          <h3 className="line-clamp-2 min-h-10 pr-1 text-sm font-bold">
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
                            {(event.categories || []).slice(0, 6).map((cat, index) => (
                              <span
                                key={cat}
                                className={"rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300 " + (index >= 3 ? "hidden lg:inline-flex" : "")}
                              >
                                {getCategoryLabel(cat)}
                              </span>
                            ))}
                            {(event.categories || []).length > 3 && (
                              <span className="rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300 lg:hidden">
                                +{(event.categories || []).length - 3}
                              </span>
                            )}
                            {(event.categories || []).length > 6 && (
                              <span className="hidden rounded-md bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300 lg:inline-flex">
                                +{(event.categories || []).length - 6}
                              </span>
                            )}
                          </div>
                          <img src="/mascots/kitsune-chan-head.png" alt="" aria-hidden="true" className="ngipen-fox-sticker pointer-events-none absolute bottom-1 right-2 h-12 w-12 object-contain drop-shadow-sm" />
                        </div>
                      </button>

                      <div className="flex items-center justify-between border-t border-red-100 bg-gradient-to-r from-white via-red-50/40 to-white px-3 py-2 dark:border-red-950 dark:from-gray-900 dark:via-red-950/20 dark:to-gray-900">
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
                  {items.length === 0 ? <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700">Belum ada rental pada kategori dan filter ini.</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((rental) => (
                      <div key={rental.id} className="min-w-0">
                        <article className={`relative flex min-w-0 flex-col overflow-visible rounded-xl border bg-white px-2 pb-3 pt-5 shadow-sm dark:bg-gray-900 sm:flex-row sm:items-center sm:gap-2 sm:p-3 ${tier === "subscription" ? "border-2 border-amber-400 shadow-amber-100/70 dark:border-amber-500 dark:shadow-amber-950/30" : tier === "verified" ? "border-2 border-blue-300 dark:border-blue-700" : "border border-gray-300 dark:border-gray-700"}`}>
                          {tier === "subscription" && <span className="font-rosehot absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 text-xl leading-none text-amber-500 dark:bg-gray-900" aria-label="Ornamen Subscription">♛</span>}
                          <div className="flex w-full shrink-0 justify-center sm:w-auto sm:justify-start">
                            <img src={rental.image_url} alt={rental.name} loading="lazy" className="h-16 w-16 max-w-full object-contain sm:h-20 sm:w-20" />
                          </div>
                          <div className="mt-2 min-w-0 flex-1 text-center sm:mt-0 sm:text-left">
                            <div className="mb-1 flex flex-wrap items-center justify-center gap-1 sm:justify-start">
                              {tier === "subscription" && <span className="font-rosehot rounded-full bg-amber-100 px-2 py-1 text-[9px] text-amber-900 dark:bg-amber-950 dark:text-amber-300">♛ SUBSCRIPTION</span>}
                              {tier === "verified" && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-black text-blue-800 dark:bg-blue-950 dark:text-blue-300">✓ VERIFIED</span>}
                              {tier === "free" && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">BASIC</span>}
                            </div>
                            <h3 className={`line-clamp-2 break-words text-xs sm:text-sm ${tier === "subscription" ? "font-rosehot font-bold text-base leading-tight text-red-800 dark:text-red-300 sm:text-lg" : "font-bold"}`}>{rental.name}</h3>
                            <p className="mt-1 break-words text-[9px] leading-snug text-gray-500 dark:text-gray-400 sm:text-[10px]">📍 {rental.city && rental.province ? `${rental.city}, ${rental.province}` : rental.region}</p>
                            <p className="mt-1 text-[9px] font-semibold text-gray-500 dark:text-gray-400 sm:text-[10px]">◉ {Number(rental.total_views || 0).toLocaleString("id-ID")} views</p>
                          </div>
                        </article>
                        <div className="mt-2 grid grid-cols-2 gap-1">
                          <button type="button" onClick={() => openRentalInstagram(rental)} className="min-w-0 rounded-lg bg-red-600 px-1 py-2 text-[9px] font-bold text-white hover:bg-red-700 sm:px-1.5 sm:text-xs">Instagram ↗</button>
                          <button type="button" onClick={() => openRentalWhatsapp(rental)} disabled={!rental.whatsapp_number} className="min-w-0 rounded-lg bg-green-600 px-1 py-2 text-[9px] font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40 sm:px-1.5 sm:text-xs">WhatsApp ↗</button>
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
                  <section><h3 className="font-rosehot mb-3 text-lg text-amber-700 dark:text-amber-300">♛ Subscription <span className="text-xs font-semibold text-gray-500">({subscription.length})</span></h3>{renderCards(subscription, "subscription")}</section>
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
  setActiveNav("home");
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
                  if (eventHistoryEntryRef.current) {
                    closeEventDetailWithHistory();
                    return;
                  }
                  setSelectedEvent(null);
                  sharedEventOpenedRef.current = null;
                  eventOpenSourceRef.current = "explore";
                  setShowCalendar(false);
                  setShowCostumeDirectory(false);
                  const cleanUrl = new URL(window.location.href);
                  cleanUrl.searchParams.delete("event");
                  window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
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
                    if (eventHistoryEntryRef.current) {
                      closeEventDetailWithHistory();
                      return;
                    }
                    setSelectedEvent(null);
                    sharedEventOpenedRef.current = null;
                    setShowCostumeDirectory(false);
                    setShowCalendar(true);
                    const cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete("event");
                    window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
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

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold text-white sm:px-4 sm:py-1.5 sm:text-sm ${
                      selectedEvent.ticket_type === "Gratis"
                        ? "bg-green-600"
                        : "bg-red-600"
                    }`}
                  >
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

                <div className="ngipen-description mt-6 overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm dark:border-red-950 dark:bg-gray-900">
  <div className="flex items-center gap-3 border-b border-red-100 bg-gradient-to-r from-red-50/80 to-white px-4 py-3 dark:border-red-950 dark:from-red-950/40 dark:to-gray-900 sm:px-5">
    <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-lg shadow-sm dark:bg-gray-800">⛩️</span>
    <div className="min-w-0 flex-1"><h2 className="text-lg font-black">Tentang Event</h2><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-600 dark:text-red-300">Informasi kegiatan</p></div>
    <img src="/mascots/kitsune-kun-head.png" alt="" aria-hidden="true" className="h-10 w-10 shrink-0 object-contain" />
  </div>
  <div className="p-4 sm:p-5">
  <p
    className={`whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-300 ${
      descriptionExpanded ? "" : "line-clamp-4"
    }`}
  >
    {selectedEvent.description || "Informasi event belum tersedia."}
  </p>

  {(selectedEvent.description || "").length > 180 && (
    <button
      type="button"
      onClick={() => setDescriptionExpanded((prev) => !prev)}
      className="mt-3 inline-flex rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
    >
      {descriptionExpanded ? "Sembunyikan" : "Lihat selengkapnya"}
    </button>
  )}
  </div>
</div>

                {currentRole === "user" && (
                  <div className="mt-5 border-t border-red-200 pt-5 dark:border-red-900">
                    <div
                      role="note"
                      aria-label="Disclaimer informasi event"
                      className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-base font-black text-red-600 shadow-sm dark:bg-red-900 dark:text-red-200"
                      >
                        i
                      </span>
                      <p className="leading-6">
                        Informasi event ini dapat berubah sewaktu-waktu. Pastikan untuk mendapatkan informasi terbaru dan resmi melalui media sosial penyelenggara event terkait.
                      </p>
                    </div>
                  </div>
                )}

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

            {/* KOMENTAR: hanya tersedia untuk sesi User/Admin */}
            {currentRole !== "guest" && <section className="mt-10">
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
                              {(review.display_name || "U")[0].toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button type="button" onClick={() => void openReviewerProfile(review.user_id)} className="text-left font-bold hover:text-red-600 hover:underline" aria-label={`Lihat profil ${review.display_name || "Pengguna"}`}>
                                {review.display_name || "Pengguna"}
                              </button>

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
            </section>}

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
                        <div className="flex items-center gap-2">
                          {doc.avatar_url ? (
                            <img src={doc.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                              {(doc.display_name || "P")[0].toUpperCase()}
                            </span>
                          )}
                          <p className="text-xs font-bold">
                            {doc.display_name || "Pengunjung"}
                          </p>
                        </div>

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
                    Username
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
                    Username
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
                  <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
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
                    <button
                      type="button"
                      onClick={() => setAdminTab("cleanup")}
                      className={`rounded-xl px-3 py-2 text-sm font-bold ${
                        adminTab === "cleanup"
                          ? "bg-red-600 text-white"
                          : "bg-gray-100 dark:bg-gray-800"
                      }`}
                    >
                      Event Cleanup
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
                          Event yang sudah selesai dapat dihapus melalui tab Event Cleanup setelah melewati masa tunggu minimal 7 hari.
                        </div>
                      )}

                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <label className="text-xs font-bold text-gray-600 dark:text-gray-300 sm:col-span-2 xl:col-span-1">
                            Cari event / pengguna / lokasi
                            <input value={adminEventSearch} onChange={(e) => setAdminEventSearch(e.target.value)} placeholder="Judul, username, kota, alamat..." className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-900" />
                          </label>
                          <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                            Kategori
                            <select value={adminEventCategoryFilter} onChange={(e) => setAdminEventCategoryFilter(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal dark:border-gray-700 dark:bg-gray-900">
                              <option value="Semua">Semua kategori</option>
                              {eventCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                            </select>
                          </label>
                          <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                            Provinsi
                            <select value={adminEventProvinceFilter} onChange={(e) => setAdminEventProvinceFilter(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal dark:border-gray-700 dark:bg-gray-900">
                              <option value="Semua">Semua provinsi</option>
                              {ALL_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
                            </select>
                          </label>
                          <label className="text-xs font-bold text-gray-600 dark:text-gray-300">
                            Sponsor
                            <select value={adminEventSponsorFilter} onChange={(e) => setAdminEventSponsorFilter(e.target.value as "Semua" | "Sponsor" | "Non-Sponsor")} className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal dark:border-gray-700 dark:bg-gray-900">
                              <option value="Semua">Semua</option><option value="Sponsor">Sponsor</option><option value="Non-Sponsor">Non-Sponsor</option>
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-gray-600 dark:text-gray-300">Menampilkan {adminFilteredEvents.length} event</span>
                          <button type="button" onClick={() => { setAdminEventSearch(""); setAdminEventCategoryFilter("Semua"); setAdminEventProvinceFilter("Semua"); setAdminEventSponsorFilter("Semua"); }} className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-bold text-gray-700 hover:border-red-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">Reset filter</button>
                        </div>
                      </div>

                      {adminEventTab === "Pending" && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                            <input type="checkbox" checked={adminFilteredEvents.length > 0 && adminFilteredEvents.every((event) => selectedPendingEventIds.includes(String(event.id)))} onChange={(e) => setSelectedPendingEventIds(e.target.checked ? adminFilteredEvents.map((event) => String(event.id)) : [])} className="h-4 w-4 accent-red-600" />
                            Pilih semua hasil filter ({adminFilteredEvents.length})
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Dipilih: {selectedPendingEventIds.length}</span>
                            <button type="button" disabled={bulkApproveLoading || selectedPendingEventIds.length === 0} onClick={() => void handleBulkApprove(selectedPendingEventIds)} className="rounded-lg bg-green-600 px-4 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">{bulkApproveLoading ? "Memproses..." : "Setujui yang dipilih"}</button>
                            <button type="button" disabled={bulkApproveLoading || adminFilteredEvents.length === 0} onClick={() => void handleBulkApprove(adminFilteredEvents.map((event) => String(event.id)))} className="rounded-lg border border-green-700 px-4 py-2 text-xs font-bold text-green-700 disabled:opacity-50 dark:text-green-300">Setujui semua hasil filter</button>
                          </div>
                        </div>
                      )}

                      {adminEventTab === "Rejected" && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
                          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                            <input
                              type="checkbox"
                              checked={adminFilteredEvents.length > 0 && adminFilteredEvents.every((event) => selectedDeleteEventIds.includes(String(event.id)))}
                              onChange={(e) => setSelectedDeleteEventIds(e.target.checked ? adminFilteredEvents.map((event) => String(event.id)) : [])}
                              className="h-4 w-4 accent-red-600"
                            />
                            Pilih semua hasil filter ({adminFilteredEvents.length})
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Dipilih: {selectedDeleteEventIds.length}</span>
                            <button
                              type="button"
                              disabled={bulkDeleteLoading || selectedDeleteEventIds.length === 0}
                              onClick={() => void handleBulkDelete(selectedDeleteEventIds)}
                              className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {bulkDeleteLoading ? "Memproses..." : "Hapus yang dipilih"}
                            </button>
                            <button
                              type="button"
                              disabled={bulkDeleteLoading || adminFilteredEvents.length === 0}
                              onClick={() => void handleBulkDelete(adminFilteredEvents.map((event) => String(event.id)))}
                              className="rounded-lg border border-red-700 px-4 py-2 text-xs font-bold text-red-700 disabled:opacity-50 dark:text-red-300"
                            >
                              Hapus semua hasil filter
                            </button>
                          </div>
                        </div>
                      )}

                      {adminFilteredEvents.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-gray-700">
                          <p className="font-bold">Belum ada event di kategori ini.</p>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Event yang sesuai akan muncul di sini.</p>
                        </div>
                      ) : (
                        <div className={(adminEventTab === "Approved" || adminEventTab === "Sponsored") ? "max-h-[68vh] overflow-y-auto overscroll-contain pr-1" : ""}>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {adminFilteredEvents.map((event) => (
                            <article key={event.id} className="flex min-w-0 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-4">
                              <div className="flex min-w-0 gap-3">
                                {adminEventTab === "Pending" && (
                                  <input aria-label={`Pilih event ${event.title}`} type="checkbox" checked={selectedPendingEventIds.includes(String(event.id))} onChange={(e) => setSelectedPendingEventIds((prev) => e.target.checked ? Array.from(new Set([...prev, String(event.id)])) : prev.filter((id) => id !== String(event.id)))} className="mt-1 h-4 w-4 shrink-0 accent-red-600" />
                                )}
                                {(adminEventTab === "Rejected" || adminEventTab === "Completed") && (
                                  <input aria-label={`Pilih event ${event.title} untuk dihapus`} type="checkbox" checked={selectedDeleteEventIds.includes(String(event.id))} onChange={(e) => setSelectedDeleteEventIds((prev) => e.target.checked ? Array.from(new Set([...prev, String(event.id)])) : prev.filter((id) => id !== String(event.id)))} className="mt-1 h-4 w-4 shrink-0 accent-red-600" />
                                )}
                                {event.poster_url ? (
                                  <img src={event.poster_url} alt={`Poster ${event.title}`} className="h-24 w-16 shrink-0 rounded-xl border border-gray-100 object-cover dark:border-gray-700 sm:h-28 sm:w-[76px]" />
                                ) : (
                                  <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400 dark:bg-gray-800 sm:h-28 sm:w-[76px]">No poster</div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <h4 className="break-words font-bold leading-snug text-gray-900 dark:text-white">{event.title}</h4>
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
                                    <button type="button" onClick={() => openApprovedEventEditor(event)} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">Edit Event</button>
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
                                    <button type="button" onClick={() => openApprovedEventEditor(event)} className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">Edit Event</button>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Approved", false, 0)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700">Hapus Sponsor</button>
                                    <button type="button" onClick={() => void handleModeration(event.id, "Rejected", false, 0)} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">Tolak Event</button>
                                  </>
                                )}
                                {adminEventTab === "Hidden" && (
                                  <button type="button" onClick={() => void handleModeration(event.id, "Approved")} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700">Tampilkan Kembali</button>
                                )}
                                
                              </div>
                            </article>
                          ))}
                        </div>
                        </div>
                      )}
                        {editingApprovedEvent && (
                          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Edit event disetujui">
                            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
                              <div className="flex items-center justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
                                <div><h3 className="font-bold">Edit Informasi Event</h3><p className="mt-1 text-xs text-gray-500">Status Disetujui dan Sponsor tetap dipertahankan.</p></div>
                                <button type="button" disabled={adminEditSaving} onClick={() => setEditingApprovedEvent(null)} className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-gray-100">Tutup ✕</button>
                              </div>
                              <div className="overflow-y-auto p-4">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                  <label className="text-xs font-semibold sm:col-span-2">Judul Event<input value={String(adminEditDraft.title || "")} onChange={(e) => setAdminEditDraft((d) => ({...d,title:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <label className="text-xs font-semibold sm:col-span-2">Deskripsi<textarea rows={5} value={String(adminEditDraft.description || "")} onChange={(e) => setAdminEditDraft((d) => ({...d,description:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <label className="text-xs font-semibold">Provinsi<select value={String(adminEditDraft.province || "")} onChange={(e) => setAdminEditDraft((d) => ({...d,province:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm">{ALL_PROVINCES.map((v)=><option key={v} value={v}>{v}</option>)}</select></label>
                                  <label className="text-xs font-semibold">Kota/Kabupaten<input value={String(adminEditDraft.city || "")} onChange={(e) => setAdminEditDraft((d) => ({...d,city:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <label className="text-xs font-semibold sm:col-span-2">Alamat / Tempat<input value={String(adminEditDraft.venue_address || "")} onChange={(e) => setAdminEditDraft((d) => ({...d,venue_address:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <label className="text-xs font-semibold">Tanggal Mulai<input type="date" value={String(adminEditDraft.start_date || "")} onChange={(e) => setAdminEditDraft((d) => ({...d,start_date:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <label className="text-xs font-semibold">Tanggal Selesai<input type="date" value={String(adminEditDraft.end_date || "")} onChange={(e) => setAdminEditDraft((d) => ({...d,end_date:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <label className="text-xs font-semibold">Jam Mulai<input type="time" value={String(adminEditDraft.start_time || "09:00").slice(0,5)} onChange={(e) => setAdminEditDraft((d) => ({...d,start_time:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <label className="text-xs font-semibold">Jam Selesai<input type="time" value={String(adminEditDraft.end_time || "18:00").slice(0,5)} onChange={(e) => setAdminEditDraft((d) => ({...d,end_time:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold">Kategori Event</p><div className="flex flex-wrap gap-3">{eventCategoryOptions.map((cat)=><label key={cat} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={adminEditCategories.includes(cat)} onChange={(e)=>setAdminEditCategories((prev)=>e.target.checked?[...prev,cat]:prev.filter((x)=>x!==cat))} className="accent-red-600" />{cat}</label>)}</div></div>
                                  <label className="text-xs font-semibold">Jenis Tiket<select value={String(adminEditDraft.ticket_type || "Gratis")} onChange={(e)=>setAdminEditDraft((d)=>({...d,ticket_type:e.target.value as TicketType}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm"><option>Gratis</option><option>Berbayar</option></select></label>
                                  <label className="text-xs font-semibold">Link Tiket<input value={String(adminEditDraft.ticket_url || "")} onChange={(e)=>setAdminEditDraft((d)=>({...d,ticket_url:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <label className="text-xs font-semibold">Link Registrasi<input value={String(adminEditDraft.registration_url || "")} onChange={(e)=>setAdminEditDraft((d)=>({...d,registration_url:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <label className="text-xs font-semibold">Link Sosial / Info<input value={String(adminEditDraft.social_link || "")} onChange={(e)=>setAdminEditDraft((d)=>({...d,social_link:e.target.value}))} className="mt-1 w-full rounded-lg border bg-transparent p-2 text-sm" /></label>
                                  <div className="sm:col-span-2"><p className="mb-2 text-xs font-semibold">Poster (opsional, tidak perlu pilih jika tetap)</p><div className="flex flex-wrap items-center gap-3">{adminEditPosterPreview && <img src={adminEditPosterPreview} alt="Preview poster" className="h-28 w-20 rounded-lg object-cover" />}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e)=>{const f=e.target.files?.[0]||null;setAdminEditPoster(f);if(f)setAdminEditPosterPreview(URL.createObjectURL(f));}} className="min-w-0 text-xs" /></div><p className="mt-1 text-[11px] text-gray-500">Maksimal 3 MB. Rasio 3:4, 1:1, 4:5, atau 9:16.</p></div>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 border-t p-4"><button type="button" disabled={adminEditSaving} onClick={()=>setEditingApprovedEvent(null)} className="rounded-lg border px-4 py-2 text-sm font-bold">Batal</button><button type="button" disabled={adminEditSaving} onClick={()=>void handleAdminEditEvent()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{adminEditSaving?"Menyimpan...":"Simpan Perubahan"}</button></div>
                            </div>
                          </div>
                        )}
                                        </div>
                  ) : adminTab === "users" ? (
                    <>
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-sm font-bold">Daftar pengguna</p>
                          <p className="mt-0.5 text-xs text-gray-500">{registeredUsers.length.toLocaleString("id-ID")} akun terdaftar</p>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <label className="relative min-w-0 flex-1 sm:min-w-[240px]">
                            <span className="sr-only">Cari pengguna</span>
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path strokeLinecap="round" d="m16 16 4 4"/></svg>
                            <input value={adminUserSearch} onChange={(event) => { setAdminUserSearch(event.target.value); setAdminUserPage(1); }} placeholder="Cari nama atau username..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-red-950" />
                          </label>
                          <select value={adminUserSort} onChange={(event) => { setAdminUserSort(event.target.value as typeof adminUserSort); setAdminUserPage(1); }} aria-label="Urutkan pengguna" className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900">
                            <option value="Terbaru">Terbaru</option>
                            <option value="Terlama">Terlama</option>
                            <option value="Klik terbanyak">Klik terbanyak</option>
                            <option value="Event tersimpan terbanyak">Event tersimpan terbanyak</option>
                          </select>
                        </div>
                      </div>

                      {adminUsersLoadError && (
                        <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">Statistik pengguna tidak dapat dimuat: {adminUsersLoadError}</p>
                      )}
                      {usersLoadError && !adminUsersLoadError && (
                        <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">Data pengguna tidak dapat dimuat: {usersLoadError}</p>
                      )}

                      {adminUsersLoading ? (
                        <p className="py-10 text-center text-sm text-gray-500">Memuat statistik pengguna...</p>
                      ) : (() => {
                        const query = adminUserSearch.trim().toLocaleLowerCase("id-ID");
                        const filteredUsers = registeredUsers.filter((user) =>
                          !query || (user.display_name || "").toLocaleLowerCase("id-ID").includes(query) || (user.username || "").toLocaleLowerCase("id-ID").includes(query)
                        );
                        const sortedUsers = [...filteredUsers].sort((a, b) => {
                          if (adminUserSort === "Terlama") return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                          if (adminUserSort === "Klik terbanyak") return (b.totalClicks || 0) - (a.totalClicks || 0);
                          if (adminUserSort === "Event tersimpan terbanyak") return (b.savedEventsCount || 0) - (a.savedEventsCount || 0);
                          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                        });
                        const totalPages = Math.max(1, Math.ceil(sortedUsers.length / adminUsersPerPage));
                        const currentPage = Math.min(adminUserPage, totalPages);
                        const visibleUsers = sortedUsers.slice((currentPage - 1) * adminUsersPerPage, currentPage * adminUsersPerPage);
                        return sortedUsers.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-700">
                            <p className="text-sm font-semibold">{query ? "Pengguna tidak ditemukan." : "Belum ada data pengguna."}</p>
                            <p className="mt-1 text-xs text-gray-500">{query ? "Coba kata kunci lain." : "Data pengguna akan tampil di sini."}</p>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span>Menampilkan {(currentPage - 1) * adminUsersPerPage + 1}–{Math.min(currentPage * adminUsersPerPage, sortedUsers.length)} dari {sortedUsers.length} pengguna</span>
                                <select value={adminUsersPerPage} onChange={(event) => { setAdminUsersPerPage(Number(event.target.value)); setAdminUserPage(1); }} aria-label="Jumlah pengguna per halaman" className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs dark:border-gray-700 dark:bg-gray-900">
                                  <option value={10}>10 / halaman</option><option value={25}>25 / halaman</option><option value={50}>50 / halaman</option>
                                </select>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" disabled={currentPage <= 1} onClick={() => setAdminUserPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700">Sebelumnya</button>
                                <span className="min-w-[64px] text-center text-xs font-semibold tabular-nums">{currentPage} / {totalPages}</span>
                                <button type="button" disabled={currentPage >= totalPages} onClick={() => setAdminUserPage((page) => Math.min(totalPages, page + 1))} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700">Berikutnya</button>
                              </div>
                            </div>
                            <div className="max-h-[55vh] overflow-y-scroll rounded-xl border border-gray-200 dark:border-gray-800">
                              <div className="overflow-x-auto">
                              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                                <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                                  <tr>
                                    <th className="px-4 py-3">Pengguna</th>
                                    <th className="px-4 py-3">Bergabung</th>
                                    <th className="px-4 py-3 text-center">Event tersimpan</th>
                                    <th className="px-4 py-3 text-center">Klik unik</th>
                                    <th className="px-4 py-3 text-right">Detail</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                  {visibleUsers.map((user) => (
                                    <tr key={user.id} onClick={() => setSelectedAdminUser(user)} className="cursor-pointer transition hover:bg-red-50/60 dark:hover:bg-red-950/20">
                                      <td className="px-4 py-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                          {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-700 dark:bg-red-950 dark:text-red-300">{(user.display_name || user.username || "?")[0].toUpperCase()}</div>}
                                          <div className="min-w-0">
                                            <p className="max-w-[220px] truncate font-bold text-gray-900 dark:text-white">{user.display_name || user.username}</p>
                                            <p className="max-w-[220px] truncate text-xs text-gray-500">@{user.username}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{user.created_at ? new Date(user.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                                      <td className="px-4 py-3 text-center">
                                        <button type="button" onClick={(event) => { event.stopPropagation(); void openUserSavedEvents(user); }} className="rounded-lg px-3 py-1.5 font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" aria-label={`Lihat ${user.savedEventsCount ?? 0} event tersimpan milik ${user.username}`}>{user.savedEventsCount ?? 0}</button>
                                      </td>
                                      <td className="px-4 py-3 text-center font-semibold tabular-nums">{(user.totalClicks ?? 0).toLocaleString("id-ID")}</td>
                                      <td className="px-4 py-3 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedAdminUser(user); }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:border-red-300 hover:text-red-600 dark:border-gray-700 dark:text-gray-200">Lihat detail</button></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              </div>
                            </div>

                          </>
                        );
                      })()}
                    </div>

                    {selectedAdminUser && (
                      <div className="fixed inset-0 z-[125] flex justify-end bg-black/45" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAdminUser(null); }}>
                        <aside role="dialog" aria-modal="true" aria-label={`Detail pengguna ${selectedAdminUser.username}`} className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900" onMouseDown={(event) => event.stopPropagation()}>
                          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
                            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-600">Manajemen pengguna</p><h3 className="mt-1 text-lg font-black">Detail Pengguna</h3></div>
                            <button type="button" onClick={() => setSelectedAdminUser(null)} aria-label="Tutup detail pengguna" className="rounded-full px-3 py-1 text-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">×</button>
                          </div>
                          <div className="space-y-5 p-5">
                            <div className="flex items-center gap-4">
                              {selectedAdminUser.avatar_url ? <img src={selectedAdminUser.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover ring-4 ring-red-50 dark:ring-red-950/50" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-xl font-black text-red-700 dark:bg-red-950 dark:text-red-300">{(selectedAdminUser.display_name || selectedAdminUser.username || "?")[0].toUpperCase()}</div>}
                              <div className="min-w-0"><h4 className="truncate text-lg font-black">{selectedAdminUser.display_name || selectedAdminUser.username}</h4><p className="truncate text-sm text-gray-500">@{selectedAdminUser.username}</p><span className="mt-1 inline-flex rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700 dark:bg-green-950/50 dark:text-green-300">Akun terdaftar</span></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950"><p className="text-xs text-gray-500">Event tersimpan</p><p className="mt-1 text-2xl font-black text-red-600">{(selectedAdminUser.savedEventsCount ?? 0).toLocaleString("id-ID")}</p><button type="button" onClick={() => { setSelectedAdminUser(null); void openUserSavedEvents(selectedAdminUser); }} className="mt-2 text-xs font-bold text-red-600 hover:underline">Lihat daftar event →</button></div>
                              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950"><p className="text-xs text-gray-500">Total klik unik</p><p className="mt-1 text-2xl font-black">{(selectedAdminUser.totalClicks ?? 0).toLocaleString("id-ID")}</p></div>
                            </div>
                            <div className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                              <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Nama tampilan</p><p className="mt-1 text-sm font-semibold">{selectedAdminUser.display_name || "Belum diatur"}</p></div>
                              <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Username</p><p className="mt-1 text-sm font-semibold">@{selectedAdminUser.username}</p></div>
                              <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Bio</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-300">{selectedAdminUser.bio?.trim() || "Belum mengisi bio."}</p></div>
                              <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Tanggal bergabung</p><p className="mt-1 text-sm font-semibold">{selectedAdminUser.created_at ? new Date(selectedAdminUser.created_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }) : "Tidak tersedia"}</p></div>
                              <div><p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">ID pengguna</p><p className="mt-1 break-all font-mono text-xs text-gray-500">{selectedAdminUser.id}</p></div>
                            </div>
                            <p className="text-xs leading-5 text-gray-500">Panel ini hanya menampilkan informasi akun dan statistik yang tersedia. Tidak ada perubahan pada data akun pengguna.</p>
                          </div>
                        </aside>
                      </div>
                    )}
                    {savedEventsUser && (
                      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 sm:p-5" role="dialog" aria-modal="true" aria-label="Daftar event tersimpan">
                        <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
                          <div className="flex items-start justify-between gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
                            <div className="min-w-0">
                              <h3 className="font-bold text-gray-900 dark:text-white">Event Tersimpan</h3>
                              <p className="mt-1 truncate text-xs text-gray-500">@{savedEventsUser.username} · {savedEventsList.length} event</p>
                            </div>
                            <button type="button" onClick={() => setSavedEventsUser(null)} className="rounded-lg px-3 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Tutup ✕</button>
                          </div>
                          <div className="overflow-y-auto p-4">
                            {savedEventsLoading ? (
                              <p className="py-10 text-center text-sm text-gray-500">Memuat daftar event...</p>
                            ) : savedEventsError ? (
                              <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{savedEventsError}</p>
                            ) : savedEventsList.length === 0 ? (
                              <p className="py-10 text-center text-sm text-gray-500">Pengguna ini belum menyimpan event.</p>
                            ) : (
                              <div className="space-y-3">
                                {savedEventsList.map((item, index) => (
                                  <div key={`${item.event?.id || "event"}-${index}`} className="flex gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                                    {item.event?.poster_url ? (
                                      <img src={item.event.poster_url} alt={`Poster ${item.event.title || "event"}`} className="h-20 w-14 shrink-0 rounded-lg object-cover" />
                                    ) : (
                                      <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-400 dark:bg-gray-800">No poster</div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="break-words text-sm font-bold text-gray-900 dark:text-white">{item.event?.title || "Event tidak tersedia"}</p>
                                      {item.event && <>
                                        <p className="mt-1 text-xs text-gray-500">{item.event.start_date || "Tanggal belum tersedia"}{item.event.city ? ` · ${item.event.city}` : ""}</p>
                                        <p className="mt-1 text-xs text-gray-500">Status: {item.event.moderation_status || "Tidak diketahui"}</p>
                                      </>}
                                      <p className="mt-1 text-[11px] text-gray-400">Disimpan: {item.savedAt ? new Date(item.savedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—"}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    </>
              ) : adminTab === "cleanup" ? (
                <AdminCleanupPanel
                  onCleanupComplete={(eventId) => {
                    setEvents((current) =>
                      current.filter((event) => String(event.id) !== eventId)
                    );
                  }}
                />
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
        {reviewerProfileLoading && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-4" role="status">
            <div className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold shadow-xl dark:bg-gray-900">Memuat profil...</div>
          </div>
        )}
        {selectedReviewerProfile && (
          <div className="fixed inset-0 z-[181] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedReviewerProfile(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="reviewer-profile-title" className="relative w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl dark:bg-gray-900">
              <button type="button" onClick={() => setSelectedReviewerProfile(null)} aria-label="Tutup kartu profil" className="absolute right-3 top-3 rounded-full px-3 py-1 text-2xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">×</button>
              {selectedReviewerProfile.avatar_url ? <img src={selectedReviewerProfile.avatar_url} alt="" className="mx-auto h-24 w-24 rounded-full object-cover ring-4 ring-red-100 dark:ring-red-950" /> : <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-100 text-3xl font-black text-red-700 dark:bg-red-950 dark:text-red-300">{(selectedReviewerProfile.display_name || "P")[0].toUpperCase()}</div>}
              <h2 id="reviewer-profile-title" className="mt-4 text-xl font-black">{selectedReviewerProfile.display_name || "Pengguna"}</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600 dark:text-gray-300">{selectedReviewerProfile.bio || "Belum ada bio."}</p>
              <div className="mt-5 flex items-center justify-center gap-3">
                {selectedReviewerProfile.instagram_url && <a href={selectedReviewerProfile.instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram" className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 text-xl hover:border-red-500 hover:text-red-600 dark:border-gray-700">◎</a>}
                {selectedReviewerProfile.tiktok_url && <a href={selectedReviewerProfile.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok" title="TikTok" className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 text-xl font-black hover:border-red-500 hover:text-red-600 dark:border-gray-700">♪</a>}
              </div>
            </section>
          </div>
        )}

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
                        maxLength={160}
                        placeholder="Ceritakan sedikit tentang dirimu..."
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950"
                      />
                    </div>

                    <div>
                      <label htmlFor="edit-user-instagram" className="mb-1 block text-sm font-semibold">Link Instagram</label>
                      <input id="edit-user-instagram" type="url" defaultValue={registeredUsers.find((user) => user.id === currentUserId)?.instagram_url || ""} maxLength={2048} placeholder="https://www.instagram.com/username" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950" />
                    </div>

                    <div>
                      <label htmlFor="edit-user-tiktok" className="mb-1 block text-sm font-semibold">Link TikTok</label>
                      <input id="edit-user-tiktok" type="url" defaultValue={registeredUsers.find((user) => user.id === currentUserId)?.tiktok_url || ""} maxLength={2048} placeholder="https://www.tiktok.com/@username" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-950" />
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
        <style jsx global>{`
          @keyframes posterMotionBlur {
            0% {
              filter: blur(10px);
              opacity: 0.55;
              transform: translateY(12px) scale(0.985);
            }
            65% {
              filter: blur(1.5px);
              opacity: 0.95;
              transform: translateY(-1px) scale(1.002);
            }
            100% {
              filter: blur(0);
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes posterBackdropMotion {
            0% {
              filter: blur(30px);
              opacity: 0.25;
              transform: scale(1.22) translateY(10px);
            }
            70% {
              filter: blur(22px);
              opacity: 0.72;
              transform: scale(1.14) translateY(-2px);
            }
            100% {
              filter: blur(20px);
              opacity: 0.62;
              transform: scale(1.12) translateY(0);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .poster-preview-motion,
            .poster-preview-backdrop {
              animation: none !important;
              transform: none !important;
            }

            .poster-preview-motion {
              filter: none !important;
              opacity: 1 !important;
            }

            .poster-preview-backdrop {
              filter: blur(20px) !important;
              opacity: 0.62 !important;
            }
          }
        `}</style>
        {activeEventPreview && (currentRole === "user" || currentRole === "guest") && (
          <div
            className={`pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-black/30 p-4 backdrop-blur-md ${eventPreviewClosing ? "animate-[previewFadeOut_0.14s_ease-in_forwards]" : "animate-[fadeIn_0.12s_ease-out]"}`}
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              backgroundColor: "rgba(0, 0, 0, 0.30)",
              transform: "translateZ(0)",
            }}
          >
            <div className={`w-full max-w-[360px] overflow-hidden rounded-2xl border-0 bg-white shadow-2xl dark:bg-gray-900 sm:w-[min(92vw,1100px)] sm:max-w-[1100px] sm:max-h-[90vh] sm:bg-transparent sm:shadow-none sm:dark:bg-transparent ${eventPreviewClosing ? "animate-[previewPopOut_0.14s_ease-in_forwards]" : "animate-[previewPopIn_0.16s_ease-out]"}`}>
              <div className="sm:grid sm:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] sm:items-stretch">
                {/* KOLOM KIRI: POSTER DAN IDENTITAS EVENT */}
                <div className="min-w-0 sm:flex sm:min-h-0 sm:flex-col">
                  <div className="relative flex max-h-[58vh] items-center justify-center overflow-hidden bg-transparent sm:max-h-[calc(90vh-124px)] sm:flex-1">
                    {activeEventPreview.poster_url ? (
                      <img
                        src={activeEventPreview.poster_url}
                        alt={`Preview poster ${activeEventPreview.title}`}
                        className="poster-preview-motion block h-auto max-h-[58vh] w-full object-contain sm:max-h-[calc(90vh-124px)] sm:w-full"
                        style={{ animation: "posterMotionBlur 420ms cubic-bezier(0.16, 1, 0.3, 1) both" }}
                      />
                    ) : (
                      <div className="flex aspect-[3/4] w-full items-center justify-center text-sm text-gray-500">Poster tidak tersedia</div>
                    )}
                  </div>

                  <div className="w-full space-y-2 bg-transparent p-4 sm:shrink-0 sm:border-t sm:border-gray-100 sm:dark:border-gray-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 line-clamp-2 rounded-lg border-0 bg-red-100 px-3 py-2 text-base font-black text-red-800 dark:bg-red-950/80 dark:text-red-100">{activeEventPreview.title}</h3>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                        activeEventPreview.ticket_type === "Gratis"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}>
                        {activeEventPreview.ticket_type === "Gratis" ? "GRATIS" : "BERBAYAR"}
                      </span>
                    </div>
                    <p className="rounded-lg border-0 bg-red-100 px-3 py-2 text-sm font-bold leading-relaxed text-red-800 dark:bg-red-950/80 dark:text-red-100">📍 {activeEventPreview.venue_address || activeEventPreview.city}{activeEventPreview.province ? `, ${activeEventPreview.province}` : ""}</p>
                    <p className="text-[10px] font-semibold text-red-600 sm:hidden">Lepaskan jari atau tombol mouse untuk menutup preview</p>
                  </div>
                </div>

                {/* KOLOM KANAN: DESKRIPSI DAN INFORMASI EVENT */}
                <div className="hidden min-w-0 border-l border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 sm:flex sm:flex-col sm:gap-5">
                  <section>
                    <h4 className="mb-3 text-sm font-extrabold uppercase tracking-wide text-gray-900 dark:text-gray-100">Deskripsi Event</h4>
                    <p className="line-clamp-6 whitespace-pre-line text-sm leading-7 text-gray-600 dark:text-gray-300">
                      {activeEventPreview.description || "Belum ada deskripsi event."}
                    </p>
                  </section>

                  <div className="h-px w-full bg-gray-100 dark:bg-gray-800" />

                  <section className="space-y-3">
                    <h4 className="text-sm font-extrabold uppercase tracking-wide text-gray-900 dark:text-gray-100">Informasi Event</h4>

                    <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/70">
                      <span className="mt-0.5 text-lg" aria-hidden="true">📅</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Tanggal & Waktu</p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                          {formatEventDate(activeEventPreview.start_date, activeEventPreview.end_date)}
                          {activeEventPreview.start_time ? ` · ${activeEventPreview.start_time.slice(0, 5)}` : ""}
                          {activeEventPreview.end_time ? `–${activeEventPreview.end_time.slice(0, 5)} WIB` : activeEventPreview.start_time ? " WIB" : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/70">
                      <span className="mt-0.5 text-lg" aria-hidden="true">📍</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Lokasi</p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                          {[activeEventPreview.venue_address, activeEventPreview.city, activeEventPreview.province].filter(Boolean).join(", ") || "Informasi lokasi belum tersedia."}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/70">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-lg" aria-hidden="true">🏷️</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Kategori</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {activeEventPreview.categories?.length ? activeEventPreview.categories.map((category) => (
                              <span key={category} className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">{getCategoryLabel(category)}</span>
                            )) : <span className="text-sm text-gray-500 dark:text-gray-400">Kategori belum tersedia.</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <p className="mt-auto pt-2 text-[10px] font-semibold text-red-600">Lepaskan tombol mouse untuk menutup preview</p>
                </div>

                {/* TAMPILAN HP TETAP DIPERTAHANKAN */}
                <div className="space-y-2 px-4 pb-4 sm:hidden">
                  <p className="line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{activeEventPreview.description || "Belum ada deskripsi event."}</p>
                </div>
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

        {/* BUKU PANDUAN NGIPEN */}
        {showGuideBook && (
          <div
            className="guide-book-overlay fixed inset-0 z-[180] flex items-center justify-center overflow-hidden p-2 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Buku Panduan NGIPEN"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowGuideBook(false);
            }}
          >
            <div className="relative h-[calc(100dvh-16px)] max-h-[860px] w-full max-w-6xl">
              <button
                type="button"
                onClick={() => setShowGuideBook(false)}
                aria-label="Tutup Buku Panduan"
                className="absolute -right-1 -top-1 z-30 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-red-700 text-2xl font-black text-white shadow-xl hover:bg-red-800 sm:-right-3 sm:-top-3"
              >
                ×
              </button>

              <div className="guide-book-shell flex h-full max-h-full flex-col overflow-hidden rounded-[22px] border-[5px] border-red-800 bg-[#f7ead2] p-2 shadow-[0_25px_90px_rgba(0,0,0,0.5)] sm:rounded-[30px] sm:border-[8px] sm:p-3">
                <div className="guide-book-paper relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[#d6b779] bg-[#fffaf0]">
                  <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60" aria-hidden="true">
                    <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-red-800 via-amber-400 to-red-800" />
                    <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full border-[18px] border-amber-100" />
                    <div className="absolute -bottom-20 -right-12 h-48 w-48 rounded-full border-[18px] border-red-100" />
                    <div className="absolute left-2 top-2 text-2xl text-amber-500/40">❖ ✦</div>
                    <div className="absolute right-2 top-2 text-2xl text-amber-500/40">✦ ❖</div>
                    <div className="absolute bottom-2 left-3 text-xl tracking-widest text-red-800/20">✧ ❖ ✧</div>
                    <div className="absolute bottom-2 right-3 text-xl tracking-widest text-amber-700/30">✦ ✧ ✦</div>
                    <div className="absolute inset-3 rounded-lg border border-amber-300/30" />
                  </div>

                  <div className="relative grid h-full min-h-0 grid-cols-1 md:grid-cols-[1fr_0.9fr]">
                    <section className="guide-book-content relative flex min-h-0 min-w-0 flex-col overflow-hidden border-r-0 border-[#e7d6b5] px-2 pb-3 pt-24 sm:px-4 sm:pb-4 sm:pt-24 md:border-r md:px-8">
                      <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-amber-500 bg-white p-1 shadow-md sm:left-5 sm:top-5 sm:h-12 sm:w-12">
                        <img src="/ngipen-logo.png" alt="Pin logo NGIPEN" className="h-full w-full object-contain" />
                      </div>
                      <div className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-amber-500 bg-white p-1 shadow-md sm:right-5 sm:top-5 sm:h-12 sm:w-12">
                        <img src="/makicos-logo.jpg" alt="Pin logo MAKICOS.ID" className="h-full w-full object-contain" />
                      </div>

                      <div className="absolute left-3 right-3 top-[68px] z-20 flex items-center justify-between sm:left-5 sm:right-5">
                        <button
                          type="button"
                          disabled={guidePage === 0}
                          onClick={() => setGuidePage((current) => Math.max(0, current - 1))}
                          aria-label="Halaman sebelumnya"
                          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-400 bg-white/95 text-xl font-black text-red-800 shadow-md transition hover:-translate-y-0.5 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          disabled={guidePage === GUIDE_BOOK_PAGES.length - 1}
                          onClick={() => setGuidePage((current) => Math.min(GUIDE_BOOK_PAGES.length - 1, current + 1))}
                          aria-label="Halaman selanjutnya"
                          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-400 bg-white/95 text-xl font-black text-red-800 shadow-md transition hover:-translate-y-0.5 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-30 sm:h-10 sm:w-10"
                        >
                          ›
                        </button>
                      </div>

                      <div className="mx-auto mb-2 flex h-[27%] min-h-[126px] max-h-[210px] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-amber-300/80 bg-gradient-to-br from-[#fff7e7] to-[#f4dfb8] p-1 shadow-sm md:hidden">
                        <img
                          src={GUIDE_MOBILE_ILLUSTRATIONS[guidePage]}
                          alt={`Ilustrasi maskot panduan halaman ${guidePage + 1}`}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col pr-1">
                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                      <div className="mt-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-700 sm:mt-3 sm:text-xs">
                        <span className="h-px w-6 bg-amber-500" />
                        {GUIDE_BOOK_PAGES[guidePage].eyebrow}
                        <span className="h-px w-6 bg-amber-500" />
                      </div>

                      <h2 className="mt-3 text-center font-serif text-sm font-black leading-tight text-red-900 sm:text-xl md:text-3xl">
                        {GUIDE_BOOK_PAGES[guidePage].title === "Sampul" ? "BUKU PANDUAN NGIPEN" : GUIDE_BOOK_PAGES[guidePage].title}
                      </h2>

                      <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-gradient-to-r from-red-700 via-amber-400 to-red-700" />

                      <div className="mt-5 space-y-3 text-[10px] leading-relaxed text-gray-800 sm:mt-5 sm:text-xs md:text-sm">
                        {GUIDE_BOOK_PAGES[guidePage].paragraphs.map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                      </div>

                      {GUIDE_BOOK_PAGES[guidePage].bullets.length > 0 && (
                        <ul className="mt-3 space-y-2 text-[9px] leading-relaxed text-gray-800 sm:mt-4 sm:text-[10px] md:text-xs">
                          {GUIDE_BOOK_PAGES[guidePage].bullets.map((item, index) => (
                            <li key={index} className="flex items-start gap-2.5">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-700 text-[10px] font-black text-white">{index + 1}</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {guidePage === GUIDE_BOOK_PAGES.length - 1 && (
                        <a
                          href="https://wa.me/62881011676184"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white shadow-md transition hover:bg-green-700"
                        >
                          <span aria-hidden="true">☘</span>
                          Hubungi WhatsApp Customer Service
                        </a>
                      )}

                      </div>
                      <div className="flex shrink-0 items-center justify-between pt-2 text-[10px] font-semibold text-amber-800">
                        <span>NGIPEN · MAKICOS.ID</span>
                        <span>HALAMAN {guidePage + 1}</span>
                      </div>
                      </div>
                    </section>

                    <section className="relative hidden min-h-0 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#fff7e7] to-[#f4dfb8] p-2 sm:p-4 md:flex md:p-6">
                      <div className="absolute inset-4 rounded-xl border border-amber-300/70" />
                      {GUIDE_SCREENSHOTS[guidePage] ? (
                        <figure className="relative z-10 flex h-full w-full max-w-full flex-col items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white/90 p-2 shadow-lg sm:p-3">
                          <div className="flex w-full items-center justify-center gap-2 text-center text-[8px] font-black uppercase tracking-[0.12em] text-red-800 sm:text-[10px] md:text-xs">
                            <span className="h-1 w-4 rounded-full bg-amber-500" />
                            Contoh Tampilan NGIPEN
                            <span className="h-1 w-4 rounded-full bg-amber-500" />
                          </div>
                          <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-lg bg-[#fffaf0]">
                            <img
                              src={GUIDE_SCREENSHOTS[guidePage].src}
                              alt={`Ilustrasi ${GUIDE_BOOK_PAGES[guidePage].title}`}
                              loading="lazy"
                              className="max-h-full max-w-full rounded-md object-contain"
                            />
                          </div>
                          <figcaption className="w-full px-1 text-center text-[8px] leading-snug text-gray-600 sm:text-[10px] md:text-xs">
                            {GUIDE_SCREENSHOTS[guidePage].caption}
                          </figcaption>
                        </figure>
                      ) : guidePage === 0 ? (
                        <div className="relative flex w-full flex-col items-center gap-4 text-center">
                          <div className="flex items-center gap-4">
                            <img src="/ngipen-logo.png" alt="Logo NGIPEN" className="h-14 w-14 rounded-full border-2 border-amber-500 bg-white p-1 object-contain shadow-md sm:h-20 sm:w-20" />
                            <img src="/makicos-logo.jpg" alt="Logo MAKICOS.ID" className="h-14 w-14 rounded-full border-2 border-amber-500 bg-white p-1 object-contain shadow-md sm:h-20 sm:w-20" />
                          </div>
                          <div className="rounded-xl border border-amber-300 bg-white/90 p-3 shadow-lg sm:p-5">
                            <p className="font-serif text-xl font-black text-red-800 sm:text-3xl">NGIPEN</p>
                            <p className="mt-1 text-xs font-bold tracking-wide text-gray-600 sm:text-sm">SATU HOBBY SATU KESERUAN</p>
                            <div className="mt-3 flex justify-center gap-1">
                              <span className="h-1.5 w-8 rounded-full bg-red-700" />
                              <span className="h-1.5 w-8 rounded-full bg-amber-400" />
                              <span className="h-1.5 w-8 rounded-full bg-red-700" />
                            </div>
                          </div>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800">Jelajahi · Temukan · Rayakan</p>
                        </div>
                      ) : guidePage === 14 ? (
                        <div className="relative w-full max-w-sm rounded-2xl border border-amber-300 bg-white p-5 text-center shadow-xl">
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">☏</div>
                          <p className="mt-3 text-xs font-black uppercase tracking-widest text-red-700">Customer Service NGIPEN</p>
                          <p className="mt-2 text-2xl font-black text-gray-900">0881011676184</p>
                          <p className="mt-2 text-xs text-gray-500">Bantuan penggunaan website</p>
                          <div className="mt-4 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white">WhatsApp Support</div>
                        </div>
                      ) : (
                        <div className="relative w-full max-w-sm rounded-2xl border border-amber-300 bg-white p-3 shadow-xl sm:p-4">
                          <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="h-6 w-6 rounded-md bg-red-700" />
                              <span className="text-xs font-black text-gray-800">NGIPEN</span>
                            </div>
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-bold text-amber-800">PANDUAN</span>
                          </div>
                          {GUIDE_BOOK_PAGES[guidePage].visual === "calendar" ? (
                            <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-gray-600">
                              {["M","S","S","R","K","J","S",...Array.from({length:28},(_,i)=>String(i+1))].map((day,i)=><span key={i} className={`rounded py-1 ${i===12?"bg-red-700 font-black text-white":"bg-gray-50"}`}>{day}</span>)}
                            </div>
                          ) : GUIDE_BOOK_PAGES[guidePage].visual === "devices" ? (
                            <div className="flex items-end justify-center gap-4">
                              <div className="w-24 rounded-xl border-4 border-gray-800 bg-gray-50 p-2"><div className="h-3 rounded bg-red-600"/><div className="mt-2 grid grid-cols-2 gap-1">{[1,2,3,4].map(x=><span key={x} className="h-10 rounded bg-amber-100"/>)}</div></div>
                              <div className="w-44 rounded-lg border-4 border-gray-700 bg-gray-50 p-2"><div className="h-3 rounded bg-red-600"/><div className="mt-2 grid grid-cols-3 gap-1">{[1,2,3].map(x=><span key={x} className="h-12 rounded bg-amber-100"/>)}</div></div>
                            </div>
                          ) : GUIDE_BOOK_PAGES[guidePage].visual === "contact" ? (
                            <div className="space-y-3 p-3">
                              <div className="rounded-lg bg-red-600 p-3 text-center text-sm font-bold text-white">Instagram ↗</div>
                              <div className="rounded-lg bg-green-600 p-3 text-center text-sm font-bold text-white">WhatsApp ↗</div>
                            </div>
                          ) : GUIDE_BOOK_PAGES[guidePage].visual === "account" ? (
                            <div className="space-y-2 p-3">
                              <div className="rounded-lg bg-gray-100 p-3 text-sm font-bold text-gray-800">Guest</div>
                              <div className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">User Login</div>
                              <div className="rounded-lg bg-amber-100 p-3 text-sm font-bold text-amber-900">Profil · Logout</div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="grid grid-cols-3 gap-2">
                                {[1,2,3].map((item)=><div key={item} className="overflow-hidden rounded-lg border border-gray-200"><div className="h-14 bg-gradient-to-br from-red-100 to-amber-100"/><div className="space-y-1 p-2"><div className="h-1.5 rounded bg-gray-300"/><div className="h-1.5 w-2/3 rounded bg-gray-200"/></div></div>)}
                              </div>
                              <div className="rounded-lg bg-red-50 p-2 text-center text-[10px] font-bold text-red-800">
                                {GUIDE_BOOK_PAGES[guidePage].visual === "rental" ? "SUBSCRIPTION · VERIFIED · BASIC" : GUIDE_BOOK_PAGES[guidePage].visual === "preview" ? "PREVIEW → DETAIL EVENT" : GUIDE_BOOK_PAGES[guidePage].visual === "saved" ? "EVENT TERSIMPAN · RATING · KOMENTAR" : GUIDE_BOOK_PAGES[guidePage].visual === "publish" ? "UPLOAD EVENT · MODERASI" : "JELAJAHI EVENT NGIPEN"}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="relative mt-4 text-center text-[10px] font-semibold uppercase tracking-widest text-amber-800">Panduan NGIPEN · MAKICOS.ID</div>
                    </section>
                  </div>
                </div>


              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
        {!selectedEvent && (
          <footer className="border-t border-gray-200 bg-white py-6 text-gray-700 dark:border-gray-800 dark:bg-[#0e121a] dark:text-gray-200 sm:py-8">
            <div className="mx-auto max-w-[1300px] px-4 sm:px-6">
              <div className="grid grid-cols-2 items-start gap-x-6 gap-y-5 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-[1.35fr_1fr_1fr_1fr_auto] lg:gap-x-10">
                {/* BRAND */}
                <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
                  <img
                    src="/ngipen-logo.png"
                    alt="Logo NGIPEN"
                    className="h-10 w-10 shrink-0 object-contain"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="min-w-0 leading-tight">
                    <span className="block text-lg font-black tracking-wide text-[#bb212d]">
                      NGIPEN
                    </span>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Satu hobby satu keseruan.
                    </p>
                  </div>
                </div>

                {/* NGIPEN LINKS */}
                <div className="min-w-0 text-xs leading-relaxed">
                  <p className="mb-2 font-bold text-gray-900 dark:text-white">
                    Jelajahi
                  </p>
                  <div className="flex flex-col items-start gap-1.5 text-gray-600 dark:text-gray-300">
                    <a
                      href="/tentang-kami"
                      className="transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      Tentang Kami
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setGuidePage(0);
                        setShowGuideBook(true);
                      }}
                      className="text-left transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      Buku Panduan
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
                      className="text-left transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      Publikasikan Event
                    </button>
                  </div>
                </div>

                {/* KOMUNITAS */}
                <div className="min-w-0 text-xs leading-relaxed">
                  <p className="mb-2 font-bold text-gray-900 dark:text-white">
                    Komunitas
                  </p>
                  <div className="flex flex-col items-start gap-1.5 text-gray-600 dark:text-gray-300">
                    <a
                      href="https://teer.id/makicos.id"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      MARI KITA COSPLAY
                    </a>
                    <a
                      href="https://www.instagram.com/angkringanevent.id/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      ANGKRINGAN EVENT ID
                    </a>
                    <a
                      href="https://www.instagram.com/wibufest.jabodetabek/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      WIBUFEST JABODETABEK
                    </a>
                    <a
                      href="https://www.instagram.com/makicos.id/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      MAKICOS ID
                    </a>
                  </div>
                </div>

                {/* IKUTI KAMI */}
                <div className="col-span-2 min-w-0 text-xs leading-relaxed sm:col-span-1">
                  <p className="mb-2 font-bold text-gray-900 dark:text-white">
                    Ikuti Kami
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href="https://www.instagram.com/makicos.id/"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram makicos.id"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#bb212d] text-white transition hover:bg-red-700"
                    >
                      <svg className="h-4 w-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                      </svg>
                    </a>
                    <a
                      href="https://www.tiktok.com/@makicos.id"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="TikTok makicos.id"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#bb212d] text-white transition hover:bg-red-700"
                    >
                      <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.49 6.27 6.27 0 0 0 1.88-4.49V8.8a8.28 8.28 0 0 0 4.89 1.58V6.93a4.85 4.85 0 0 1-1-.24z" />
                      </svg>
                    </a>
                    <a
                      href="https://trakteer.id/makicos.id/tip"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Berikan Dukungan"
                      title="Berikan Dukungan"
                      className="ml-auto flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#bb212d] px-3 text-[11px] font-bold text-white transition hover:bg-red-700 sm:ml-0"
                    >
                      ♥ <span>Dukung MAKICOS</span>
                    </a>
                  </div>
                </div>

                {/* COPYRIGHT */}
                <div className="col-span-2 border-t border-gray-200 pt-4 text-xs leading-relaxed sm:col-span-3 lg:col-span-1 lg:border-t-0 lg:pt-0 lg:text-right">
                  <p className="text-gray-500 dark:text-gray-400">© 2026 NGIPEN</p>
                </div>
              </div>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
