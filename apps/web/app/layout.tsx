import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import SiteShell from '@/components/site-shell';
import SiteContentProvider from '@/components/site-content-provider';
import { PwaProvider } from '@/components/pwa-experience';
import { getSiteContent } from '@/lib/server-api';
import './globals.css';

const baseMetadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'ORIVA — A new perspective on living', template: '%s | ORIVA' },
  description:
    'Explore a new perspective on UAE living. Discover considered homes, new developments and your next chapter with ORIVA.',
  applicationName: 'ORIVA',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'ORIVA', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { url: '/favicon.ico', type: 'image/x-icon', sizes: '32x32' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  robots: { index: false, follow: false },
  openGraph: {
    title: 'ORIVA — Built around your next chapter',
    description:
      'From a first spark to a place of your own. Discover a different perspective on UAE living.',
    type: 'website',
    images: [{ url: '/images/property-01.webp', width: 1200, height: 800 }],
  },
};
export async function generateMetadata(): Promise<Metadata> {
  const { values } = await getSiteContent();
  const locale = (await headers()).get('x-oriva-locale') === 'ar' ? 'ar' : 'en';
  const title = values['site.title']?.[locale];
  const description = values['site.description']?.[locale];
  return {
    ...baseMetadata,
    ...(title
      ? { title: { default: title, template: `%s | ${values['site.name']?.[locale] || 'ORIVA'}` } }
      : {}),
    ...(description ? { description } : {}),
    openGraph: {
      ...baseMetadata.openGraph,
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
    },
  };
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f5f1e8' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await headers()).get('x-oriva-locale') === 'ar' ? 'ar' : 'en';
  const { values, version } = await getSiteContent();
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
        <SiteContentProvider initial={values} initialVersion={version}>
          <PwaProvider>
            <SiteShell locale={locale}>{children}</SiteShell>
          </PwaProvider>
        </SiteContentProvider>
      </body>
    </html>
  );
}
