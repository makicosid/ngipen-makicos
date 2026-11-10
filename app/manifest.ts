import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'NGIPEN - Satu Hobby Satu Keseruan',
    short_name: 'NGIPEN',
    description: 'Temukan jadwal event jejepangan di seluruh Indonesia.',
    lang: 'id',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#F7F7F8',
    theme_color: '#D9232E',
    categories: ['entertainment', 'lifestyle', 'events'],
    icons: [
      { src: '/logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
