import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ORIVA — UAE Real Estate',
    short_name: 'ORIVA',
    description: 'Discover considered homes, new developments and your next chapter in the UAE.',
    lang: 'en',
    dir: 'ltr',
    start_url: '/en',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f1e8',
    theme_color: '#f5f1e8',
    categories: ['lifestyle', 'business'],
    prefer_related_applications: false,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Discover homes', short_name: 'Homes', url: '/en/properties' },
      { name: 'New developments', short_name: 'Projects', url: '/en/projects' },
      { name: 'Talk to our team', short_name: 'Our team', url: '/en/qa' },
    ],
  };
}
