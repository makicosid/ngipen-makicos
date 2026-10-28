import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'NGIPEN - Satu Hobby Satu Keseruan',
  description: 'Platform event jejepangan, cosplay, idol, toys, market Indonesia - Sync Supabase',
  icons: { icon: '/logo.png' }
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
