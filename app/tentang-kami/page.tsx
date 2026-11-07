import type { Metadata } from "next";

const SITE_URL = "https://ngipen-makicos-seven.vercel.app";

export const metadata: Metadata = {
  title: "Tentang Kami | NGIPEN – MAKICOS",
  description: "Kenali NGIPEN, platform event jejepangan yang dikembangkan oleh MAKICOS, perjalanan komunitas, ekosistem, partner, dan visi kami untuk dunia cosplay Indonesia.",
  alternates: { canonical: `${SITE_URL}/tentang-kami` },
  openGraph: {
    title: "Tentang Kami | NGIPEN – MAKICOS",
    description: "Cerita, ekosistem, partner, dan visi MAKICOS dalam mendukung komunitas cosplay Indonesia.",
    url: `${SITE_URL}/tentang-kami`, siteName: "NGIPEN", locale: "id_ID", type: "website",
    images: [{ url: "/about/ecosystem/makicos-id.jpg", alt: "MAKICOS – Mari Kita Cosplay" }],
  },
};

type Brand = { name: string; description: string; href: string; image?: string; monogram: string; category: string };

function BrandCard({ name, description, href, image, monogram, category }: Brand) {
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:p-5">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`Logo ${name}`} className="h-full w-full object-contain" loading="lazy" />
        ) : <span aria-label={`Identitas teks ${name}`} className="flex h-full w-full items-center justify-center rounded-xl bg-red-50 text-xl font-black tracking-tight text-red-700 dark:bg-red-950/50 dark:text-red-300">{monogram}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-400">{category}</p>
        <h3 className="text-base font-extrabold text-gray-900 dark:text-white">{name}</h3>
        <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{description}</p>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Kunjungi ${name} (membuka tab baru)`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-700 transition hover:border-red-600 hover:bg-red-600 hover:text-white dark:border-red-900 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-white">Kunjungi <span aria-hidden="true">↗</span></a>
    </article>
  );
}

const ecosystem: Brand[] = [
  { name: "@makicos.id", description: "Media kolaborasi cosplay Indonesia dan ruang bagi cosplayer untuk memperkenalkan karya serta kreativitasnya kepada publik.", href: "https://www.instagram.com/makicos.id/", image: "/about/ecosystem/makicos-id.jpg", monogram: "M", category: "Media utama" },
  { name: "@daily.sidecos", description: "Ruang kolaborasi foto casual, inspirasi gaya, dan tren fashion dari komunitas.", href: "https://www.instagram.com/daily.sidecos/", image: "/about/ecosystem/daily-sidecos.jpeg", monogram: "DS", category: "Casual & fashion" },
  { name: "@cosraya.collab", description: "Media kolaborasi untuk cosplayer di Surabaya dan wilayah sekitarnya.", href: "https://www.instagram.com/cosraya.collab/", image: "/about/ecosystem/cosraya-collab.jpeg", monogram: "CR", category: "Regional community" },
  { name: "@coser_notes", description: "Wadah berbagi cerita, pengalaman, dan ruang curhat yang dekat dengan keseharian para cosplayer.", href: "https://www.instagram.com/coser_notes/", monogram: "CN", category: "Cerita komunitas" },
  { name: "@makicosgame.store", description: "Toko top up game online dari MAKICOS untuk menemani keseruan bermain.", href: "https://www.instagram.com/makicosgame.store/", image: "/about/ecosystem/makicos-game-store.webp", monogram: "MG", category: "Game store" },
  { name: "@makicos.talent", description: "Membantu menghubungkan kebutuhan talent dengan penyelenggara event jejepangan.", href: "https://www.instagram.com/makicos.talent/", monogram: "MT", category: "Talent network" },
  { name: "MAKICOS × ASOBI KYOU", description: "Forum dan ruang interaksi cosplayer di Kyoummunity untuk saling terhubung dan berbagi.", href: "https://asobi.kyou.id/kyommunity/makicos-id", monogram: "K", category: "Community forum" },
];

const partners: Brand[] = [
  { name: "@angkringanevent.id", description: "Media event sekaligus organizer yang berfokus pada penyelenggaraan event jejepangan di wilayah Jabodetabek.", href: "https://www.instagram.com/angkringanevent.id/", monogram: "AE", category: "Event media & organizer" },
  { name: "@wibufest.jabodetabek", description: "Partner komunitas yang ikut meramaikan kegiatan dan pertemuan jejepangan di Jabodetabek.", href: "https://www.instagram.com/wibufest.jabodetabek/", image: "/about/partners/wibufest-jabodetabek.jpeg", monogram: "WF", category: "Community partner" },
  { name: "Kyoucosplaycorner", description: "Toko rental kostum cosplay yang melayani kebutuhan cosplayer di wilayah Jabodetabek.", href: "https://www.instagram.com/kyoucosplaycorner/", image: "/about/partners/kyou-cosplay-corner.png", monogram: "KCC", category: "Costume rental" },
  { name: "pungkicosrent", description: "Layanan rental kostum cosplay untuk cosplayer di wilayah Surabaya dan Jakarta.", href: "https://www.instagram.com/pungkicosrent/", image: "/about/partners/pungkicosrent.png", monogram: "PC", category: "Costume rental" },
];

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return <div className="mb-6 max-w-3xl"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-600 dark:text-red-400">{eyebrow}</p><h2 className="mt-2 text-2xl font-black tracking-tight text-gray-950 dark:text-white sm:text-3xl">{title}</h2>{children && <div className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300 sm:text-base">{children}</div>}</div>;
}

export default function TentangKamiPage() {
  return (
    <main className="min-h-screen bg-[#F7F7F8] text-gray-900 dark:bg-[#121212] dark:text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-5 flex items-center justify-between"><a href="/" className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-red-300 hover:text-red-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:text-red-300"><span aria-hidden="true">←</span> Kembali ke NGIPEN</a><span className="rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-red-700 dark:bg-red-950/50 dark:text-red-300">Tentang Kami</span></div>

        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-800 via-red-700 to-red-600 px-6 py-9 text-white shadow-xl sm:px-10 sm:py-12">
          <div aria-hidden="true" className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-white/10" /><div aria-hidden="true" className="absolute -bottom-28 right-20 h-64 w-64 rounded-full border border-white/15" />
          <div className="relative max-w-3xl"><p className="text-xs font-black uppercase tracking-[0.24em] text-red-100">Satu Hobby, Satu Keseruan.</p><h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">Tentang Kami</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-red-50 sm:text-base sm:leading-8">NGIPEN adalah platform informasi dan eksplorasi event jejepangan di Indonesia yang dikembangkan oleh <strong>@makicos.id</strong>. Kami ingin membuat komunitas lebih mudah menemukan event, terhubung, dan tumbuh bersama.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/about/ecosystem/makicos-id.jpg" alt="Logo MAKICOS" className="h-14 w-14 rounded-2xl bg-white object-contain p-1" /><div><p className="font-black tracking-wide">NGIPEN – MAKICOS</p><p className="text-xs text-red-100">Dikembangkan oleh @makicos.id</p></div></div>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:mt-12 sm:p-8">
          <SectionHeading eyebrow="Our story" title="Berawal dari kolaborasi, tumbuh menjadi ekosistem.">MAKICOS dibentuk pada <strong>8 Agustus 2024</strong>. Awalnya, MAKICOS dirancang sebagai media akun kolaborasi foto cosplay di Indonesia. Berangkat dari inisiatif satu orang, perjalanan ini terus berkembang dan kini didukung oleh tiga orang yang membantu menjalankan ekosistem MAKICOS.<br /><br />Seiring waktu, MAKICOS tumbuh lebih dari sekadar media kolaborasi. Kami ingin menjadi wadah bagi cosplayer untuk memperkenalkan karya, menunjukkan kreativitas, dan mengekspresikan diri kepada publik. Kami juga membangun grup komunitas yang kini telah memiliki lebih dari <strong>2.000 anggota</strong> dari berbagai daerah di Indonesia.</SectionHeading>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["08.08.2024", "Tanggal berdiri"], ["3 orang", "Tim yang membantu"], ["2.000+", "Anggota komunitas"], ["Indonesia", "Jangkauan komunitas"]].map(([value, label]) => <div key={label} className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/80"><p className="text-xl font-black tracking-tight text-red-700 dark:text-red-300 sm:text-2xl">{value}</p><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{label}</p></div>)}</div>
        </section>

        <section className="mt-10 sm:mt-12"><SectionHeading eyebrow="Our ecosystem" title="Satu komunitas, banyak ruang untuk berkembang.">Selain @makicos.id, kami menghadirkan beberapa cabang akun dan ruang komunitas dengan fokus yang berbeda. Masing-masing punya peran untuk mendukung kebutuhan dan ekspresi komunitas jejepangan.</SectionHeading><div className="grid gap-3">{ecosystem.map((brand) => <BrandCard key={brand.name} {...brand} />)}</div></section>

        <section className="mt-10 rounded-3xl bg-gray-100 p-5 dark:bg-gray-900 sm:mt-12 sm:p-8"><SectionHeading eyebrow="Partnership" title="Tumbuh bersama partner dan kolaborator.">Kami percaya ekosistem yang kuat dibangun lewat kolaborasi. Terima kasih untuk para partner yang ikut mendukung kegiatan dan kebutuhan komunitas.</SectionHeading><div className="grid gap-3">{partners.map((brand) => <BrandCard key={brand.name} {...brand} />)}</div></section>

        <section className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2"><div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 sm:p-8"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">Our vision</p><h2 className="mt-3 text-2xl font-black">Membawa cosplay Indonesia lebih dikenal luas.</h2><p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">Kami bermimpi agar dunia cosplay Indonesia semakin dikenal, diapresiasi, dan terhubung hingga ke panggung internasional.</p></div><div className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 sm:p-8"><p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600 dark:text-red-400">Our mission</p><h2 className="mt-3 text-2xl font-black">Membuka ruang untuk berkarya dan berekspresi.</h2><p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">Kami ingin terus mengembangkan ruang yang mempertemukan cosplayer, komunitas, dan penyelenggara agar bisa berkreasi, berkolaborasi, serta mengekspresikan diri dengan lebih luas.</p></div></section>

        <section className="mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-red-800 to-red-600 p-6 text-white shadow-lg sm:mt-12 sm:p-10"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-100">Support our journey</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Dukung perjalanan MAKICOS!</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-red-50 sm:text-base">Terus dukung MAKICOS sebagai tempat para cosplayer berkumpul, berkreativitas, dan berekspresi. Setiap dukungan, berapa pun jumlahnya, sangat berarti untuk perjalanan dan pengembangan ekosistem ini. Terima kasih sudah tumbuh bersama kami! ❤️</p><a href="https://teer.id/makicos.id" target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-red-700 shadow-sm transition hover:bg-red-50">Dukung Kami <span aria-hidden="true">↗</span></a></section>

        <footer className="py-8 text-center text-xs text-gray-500 dark:text-gray-400"><p className="font-bold tracking-wide">NGIPEN – MAKICOS</p><p className="mt-1">MARI KITA COSPLAY · Satu Hobby, Satu Keseruan.</p><p className="mt-3">© {new Date().getFullYear()} MAKICOS ID</p></footer>
      </div>
    </main>
  );
}
