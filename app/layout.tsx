
import './globals.css';
import type { Metadata } from 'next';

const BASE_URL = 'https://ngipen.my.id';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  applicationName: 'NGIPEN',

  alternates: {
    canonical: BASE_URL,
  },

  title: 'NGIPEN - Satu Hobby Satu Keseruan',

  description:
    'Temukan berbagai event jejepangan di seluruh Indonesia melalui NGIPEN. Jelajahi jadwal event cosplay, anime, performance, market, komunitas, serta informasi menarik lainnya dalam satu platform.',

  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: '/logo.png',
  },

  openGraph: {
    title: 'NGIPEN - Satu Hobby Satu Keseruan',

    description:
      'Temukan berbagai event jejepangan di seluruh Indonesia melalui NGIPEN. Jelajahi jadwal event cosplay, anime, performance, market, komunitas, serta informasi menarik lainnya dalam satu platform.',

    url: BASE_URL,
    siteName: 'NGIPEN',
    locale: 'id_ID',
    type: 'website',

    images: [
      {
        url: '/ngipen-og-preview.jpg',
        width: 1200,
        height: 630,
        alt: 'NGIPEN - Satu Hobby Satu Keseruan',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',

    title: 'NGIPEN - Satu Hobby Satu Keseruan',

    description:
      'Temukan berbagai event jejepangan di seluruh Indonesia melalui NGIPEN. Jelajahi jadwal event cosplay, anime, performance, market, komunitas, serta informasi menarik lainnya dalam satu platform.',

    images: ['/ngipen-og-preview.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const websiteStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'NGIPEN',
    alternateName: 'NGIPEN - Satu Hobby Satu Keseruan',
    url: BASE_URL,
  };

  return (
    <html lang="id" suppressHydrationWarning>
      <body className="bg-[#F7F7F8] dark:bg-[#121212] text-[#242424] dark:text-white antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteStructuredData),
          }}
        />

        {children}
      </body>
    </html>
  );
}
