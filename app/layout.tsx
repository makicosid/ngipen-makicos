import './globals.css';
import type { Metadata } from 'next';

const BASE_URL = 'https://ngipen-makicos-seven.vercel.app';

export const metadata: Metadata = {
  title: 'NGIPEN - Satu Hobby Satu Keseruan',
  description: 'Platform event jejepangan, cosplay, idol, toys, market Indonesia. Temukan dan bagikan event jejepangan terlengkap di Indonesia.',
  metadataBase: new URL(BASE_URL),
  icons: { icon: '/logo.png' },
  openGraph: {
    title: 'NGIPEN - Satu Hobby Satu Keseruan',
    description: 'Platform event jejepangan, cosplay, idol, toys, market Indonesia. Temukan dan bagikan event jejepangan terlengkap di Indonesia.',
    url: BASE_URL,
    siteName: 'NGIPEN',
    locale: 'id_ID',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NGIPEN - Satu Hobby Satu Keseruan',
    description: 'Platform event jejepangan, cosplay, idol, toys, market Indonesia.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="bg-[#F7F7F8] dark:bg-[#121212] text-[#242424] dark:text-white antialiased">
        {children}
      </body>
    </html>
  );
}
