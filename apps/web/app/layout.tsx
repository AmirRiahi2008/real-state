import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import SiteShell from '@/components/site-shell';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'ORIVA — A new perspective on living', template: '%s | ORIVA' },
  description:
    'Explore a new perspective on UAE living. Discover considered homes, new developments and your next chapter with ORIVA.',
  applicationName: 'ORIVA',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'ORIVA — Built around your next chapter',
    description:
      'From a first spark to a place of your own. Discover a different perspective on UAE living.',
    type: 'website',
    images: [{ url: '/images/property-01.webp', width: 1200, height: 800 }],
  },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f6f5f0' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await headers()).get('x-oriva-locale') === 'ar' ? 'ar' : 'en';
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=localStorage.getItem('oriva-theme')==='dark'?'dark':'light'}catch{document.documentElement.dataset.theme='light'}",
          }}
        />
      </head>
      <body>
        <SiteShell locale={locale}>{children}</SiteShell>
      </body>
    </html>
  );
}
