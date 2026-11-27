import Link from "next/link";

const WHATSAPP_NUMBER = "628138106774";

const packages = [
  {
    id: "bronze",
    name: "BRONZE",
    medal: "🥉",
    price: "Rp500.000",
    duration: "7 Hari",
    promoBonus: "First Promote bonus durasi 3 hari menjadi 10 hari promote",
    tone: "bronze",
    website: [
      "1 slot iklan pilihan (Banner / Popup / Floating).",
    ],
    media: [
      "1x Instagram Pin Feed Collab Post (bukan carousel) + Share to Story.",
      "1x WhatsApp Channel Post.",
      "1x publikasi di Grup Cosplay MAKICOS.",
    ],
  },
  {
    id: "silver",
    name: "SILVER",
    medal: "🥈",
    price: "Rp750.000",
    duration: "14 Hari",
    promoBonus: "First Promote bonus durasi 6 hari menjadi 20 hari promote",
    tone: "silver",
    website: [
      "1 slot iklan pilihan (Banner / Popup / Floating).",
      "1x pergantian campaign/produk selama durasi ads tersedia.",
    ],
    media: [
      "1x Instagram Pin Feed Post (bukan carousel).",
      "3x Instagram Story Post.",
      "1x WhatsApp Channel Post.",
      "1x publikasi di Grup Cosplay MAKICOS.",
    ],
  },
  {
    id: "gold",
    name: "GOLD",
    medal: "🥇",
    price: "Rp1.500.000",
    duration: "30 Hari",
    promoBonus: "First Promote bonus durasi 15 hari menjadi 45 hari promote",
    tone: "gold",
    featured: true,
    website: [
      "Banner Ads.",
      "Popup Ads.",
      "Floating Ads.",
      "3x pergantian campaign/produk selama durasi ads tersedia.",
    ],
    media: [
      "1x Instagram Pin Feed Post (Carousel 5 Slide).",
      "30x Instagram Story Post (1x per hari).",
      "3x WhatsApp Channel Post.",
      "3x Instagram Channel Post.",
      "3x publikasi di Grup Cosplay MAKICOS.",
    ],
  },
] as const;

function whatsappLink(packageName: string) {
  const message = `hai kak makicos aku mau promote paket ${packageName.toLowerCase()} nya`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export default function AdsPromotePage() {
  return (
    <main className="ads-promote-page min-h-screen overflow-hidden bg-[#faf9f7] text-[#242424] dark:bg-[#101114] dark:text-white">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="ads-promote-enter mb-8 flex items-center justify-between gap-4 sm:mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <span aria-hidden="true">←</span>
            Kembali ke NGIPEN
          </Link>
        </div>

        <header className="ads-promote-enter mx-auto mb-9 max-w-3xl text-center sm:mb-12">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-red-700 dark:text-red-400">
            Grow your reach with us
          </p>
          <h1 className="text-3xl font-black tracking-tight text-gray-950 sm:text-5xl dark:text-white">
            ADS <span className="text-[#bb212d]">PROMOTE</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base dark:text-gray-300">
            Pilih paket promosi yang sesuai dengan kebutuhan campaign kamu.
            Jangkau komunitas jejepangan bersama NGIPEN dan MAKICOS.
          </p>
          <div className="mx-auto mt-5 h-1 w-20 rounded-full bg-gradient-to-r from-red-700 via-amber-400 to-red-700" />
        </header>

        <section aria-label="Pilihan paket ADS PROMOTE" className="grid items-stretch gap-5 lg:grid-cols-3 lg:gap-6">
          {packages.map((pkg, index) => (
            <article
              key={pkg.id}
              className={`ads-promote-card ads-promote-card--${pkg.tone} relative flex h-full flex-col rounded-3xl border bg-white p-5 shadow-[0_14px_45px_rgba(30,20,20,0.06)] sm:p-7 dark:bg-[#191a1f] ${pkg.id === "gold" ? "border-amber-400 shadow-[0_18px_55px_rgba(180,130,35,0.15)] lg:-translate-y-2" : "border-gray-200 dark:border-gray-700"}`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                    {pkg.medal} {pkg.name} PACKAGE
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-[2rem] dark:text-white">
                    {pkg.price}
                  </p>
                </div>
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl ${pkg.id === "gold" ? "bg-amber-100 dark:bg-amber-400/15" : "bg-gray-100 dark:bg-gray-800"}`}>
                  {pkg.medal}
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.05]">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                  Durasi Promosi
                </p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-lg font-extrabold text-gray-900 dark:text-white">
                    {pkg.duration}
                  </p>
                  {pkg.id === "gold" && (
                    <span className="inline-flex rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#38270a] shadow-sm">
                      Best Value · Recommended
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs font-semibold italic leading-5 text-red-600 dark:text-red-400">
                  {pkg.promoBonus}
                </p>
              </div>

              <div className="mt-6 flex-1 space-y-6">
                <div>
                  <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-red-700 dark:text-red-400">
                    <span aria-hidden="true">▣</span> Website NGIPEN
                  </h2>
                  <ul className="space-y-2.5">
                    {pkg.website.map((item) => (
                      <li key={item} className="flex gap-2.5 text-sm leading-6 text-gray-700 dark:text-gray-200">
                        <span className="mt-0.5 font-black text-red-600">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-red-700 dark:text-red-400">
                    <span aria-hidden="true">◎</span> Media Promotion MAKICOS
                  </h2>
                  <ul className="space-y-2.5">
                    {pkg.media.map((item) => (
                      <li key={item} className="flex gap-2.5 text-sm leading-6 text-gray-700 dark:text-gray-200">
                        <span className="mt-0.5 font-black text-red-600">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <a
                href={whatsappLink(pkg.name)}
                className={`mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-[#191a1f] ${pkg.id === "gold" ? "bg-[#bb212d] text-white shadow-lg shadow-red-900/15 hover:bg-red-800" : "border border-gray-200 bg-gray-950 text-white hover:bg-red-700 dark:border-gray-600 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"}`}
              >
                <span aria-hidden="true">☏</span>
                Pesan Sekarang
              </a>
            </article>
          ))}
        </section>

        <footer className="ads-promote-enter mx-auto mt-10 max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm sm:mt-14 sm:p-7 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-red-700 dark:text-red-400">
            Need more information?
          </p>
          <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-white">
            Hubungi MAKICOS
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Konsultasikan kebutuhan promosi dan campaign kamu bersama tim MAKICOS.
          </p>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("hai kak makicos, aku mau tanya tentang paket ads promote")}`}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-green-600 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-green-700"
          >
            <span aria-hidden="true">☏</span>
            WhatsApp MAKICOS · 081381067774
          </a>
        </footer>

        <p className="mt-8 text-center text-[10px] font-semibold tracking-wide text-gray-400">
          © {new Date().getFullYear()} NGIPEN · MAKICOS.ID
        </p>
      </div>
    </main>
  );
}
