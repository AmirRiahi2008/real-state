'use client';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Locale } from '@/lib/api';
import type { SiteValues } from '@/lib/admin-types';
import { siteText } from '@/lib/site-content';

export const siteContentChannel = 'oriva-site-content-updated';
const ContentContext = createContext<SiteValues>({});
export function useSiteText(locale: Locale) {
  const values = useContext(ContentContext);
  return (key: string, fallback: string) => siteText(values, key, locale, fallback);
}
export function announceSiteContentUpdate(values: SiteValues, version: number) {
  window.dispatchEvent(new CustomEvent(siteContentChannel, { detail: { values, version } }));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(siteContentChannel);
    channel.postMessage({ type: 'updated' });
    channel.close();
  }
}
export default function SiteContentProvider({
  initial,
  initialVersion,
  children,
}: {
  initial: SiteValues;
  initialVersion: number;
  children: ReactNode;
}) {
  const [values, setValues] = useState(initial);
  const pathname = usePathname();
  const router = useRouter();
  const version = useRef(initialVersion);
  useEffect(() => {
    setValues(initial);
    version.current = initialVersion;
  }, [initial, initialVersion]);
  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    let busy = false;
    async function refresh() {
      if (stopped || busy || document.hidden) return;
      busy = true;
      controller = new AbortController();
      try {
        const r = await fetch('/api/backend/v1/site-content', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (r.ok) {
          const body = await r.json();
          if (!stopped && body.values && typeof body.values === 'object') {
            setValues(body.values);
            if (Number.isInteger(body.version) && body.version !== version.current) {
              version.current = body.version;
              if (!/^\/(en|ar)\/admin(?:\/|$)/.test(pathname)) router.refresh();
            }
          }
        }
      } catch {
        /* Keep the last usable public content during a temporary service interruption. */
      } finally {
        busy = false;
      }
    }
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ values: SiteValues; version: number }>).detail;
      if (detail) {
        setValues(detail.values);
        version.current = detail.version;
      } else void refresh();
    };
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(siteContentChannel) : null;
    if (channel) channel.onmessage = () => void refresh();
    const tick = () => void refresh();
    window.addEventListener(siteContentChannel, onUpdate);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    const timer = window.setInterval(tick, 60000);
    return () => {
      stopped = true;
      controller?.abort();
      channel?.close();
      clearInterval(timer);
      window.removeEventListener(siteContentChannel, onUpdate);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [pathname, router]);
  return <ContentContext.Provider value={values}>{children}</ContentContext.Provider>;
}
