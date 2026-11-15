'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Download, RefreshCw, Share2, WifiOff, X } from 'lucide-react';
import type { Locale } from '@/lib/api';
import './pwa-experience.css';

type InstallOutcome = 'accepted' | 'dismissed' | 'manual';
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
interface InstallContext {
  installed: boolean;
  installing: boolean;
  install(): Promise<InstallOutcome>;
}
const PwaContext = createContext<InstallContext | null>(null);

export function PwaProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ar = pathname.startsWith('/ar');
  const privateWorkspace = /^\/(en|ar)\/(admin|dashboard)(?:\/|$)/.test(pathname);
  const prompt = useRef<InstallPromptEvent | null>(null);
  const waitingWorker = useRef<ServiceWorker | null>(null);
  const reloadAfterUpdate = useRef(false);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [offline, setOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia(
      '(display-mode: standalone), (display-mode: minimal-ui), (display-mode: fullscreen)',
    );
    const checkInstalled = () =>
      setInstalled(
        displayMode.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true,
      );
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      prompt.current = event as InstallPromptEvent;
    };
    const onInstalled = () => {
      prompt.current = null;
      setInstalled(true);
    };
    const checkConnection = () => setOffline(!navigator.onLine);
    checkInstalled();
    checkConnection();
    displayMode.addEventListener('change', checkInstalled);
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    return () => {
      displayMode.removeEventListener('change', checkInstalled);
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, []);

  useEffect(() => {
    // Development stays network-only; verify install/offline support using the production build.
    if (
      process.env.NODE_ENV !== 'production' ||
      !window.isSecureContext ||
      !('serviceWorker' in navigator)
    )
      return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | undefined;
    let lastCheck = Date.now();
    const cleanupWorkers: Array<() => void> = [];
    const detectUpdate = () => {
      if (registration?.waiting && navigator.serviceWorker.controller) {
        waitingWorker.current = registration.waiting;
        setUpdateReady(true);
      }
    };
    const watchInstallation = () => {
      const worker = registration?.installing;
      if (!worker) return;
      const onStateChange = () => {
        if (worker.state === 'installed') detectUpdate();
      };
      worker.addEventListener('statechange', onStateChange);
      cleanupWorkers.push(() => worker.removeEventListener('statechange', onStateChange));
    };
    const checkForUpdate = () => {
      if (
        !registration ||
        !navigator.onLine ||
        document.visibilityState !== 'visible' ||
        Date.now() - lastCheck < 60 * 60 * 1000
      )
        return;
      lastCheck = Date.now();
      void registration.update().catch(() => undefined);
    };
    const onControllerChange = () => {
      if (!reloadAfterUpdate.current) return;
      reloadAfterUpdate.current = false;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((value) => {
        if (cancelled) return;
        registration = value;
        registration.addEventListener('updatefound', watchInstallation);
        watchInstallation();
        detectUpdate();
      })
      .catch(() => {
        // A blocked worker must not prevent using the connected website.
      });
    return () => {
      cancelled = true;
      registration?.removeEventListener('updatefound', watchInstallation);
      cleanupWorkers.forEach((cleanup) => cleanup());
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', checkForUpdate);
      window.removeEventListener('online', checkForUpdate);
    };
  }, []);

  useEffect(() => {
    const syncThemeColor = () => {
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute(
          'content',
          document.documentElement.dataset.theme === 'dark' ? '#101d25' : '#f5f1e8',
        );
    };
    syncThemeColor();
    const observer = new MutationObserver(syncThemeColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [pathname]);

  async function install(): Promise<InstallOutcome> {
    const event = prompt.current;
    if (!event) return 'manual';
    prompt.current = null;
    setInstalling(true);
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      return outcome;
    } catch {
      return 'manual';
    } finally {
      setInstalling(false);
    }
  }

  function applyUpdate() {
    if (!waitingWorker.current) return;
    reloadAfterUpdate.current = true;
    setUpdateReady(false);
    waitingWorker.current.postMessage({ type: 'SKIP_WAITING' });
  }

  return (
    <PwaContext value={{ installed, installing, install }}>
      {children}
      {!privateWorkspace && (offline || updateReady) ? (
        <aside className="pwa-status" aria-label={ar ? 'حالة التطبيق' : 'App status'}>
          {offline ? (
            <p role="status">
              <WifiOff size={17} aria-hidden="true" />
              {ar
                ? 'أنت غير متصل. العقارات والرسائل تحتاج إلى اتصال بالإنترنت.'
                : 'You’re offline. Live listings and messages need a connection.'}
            </p>
          ) : (
            <>
              <p role="status">{ar ? 'نسخة جديدة من أوريفا جاهزة.' : 'A new ORIVA is ready.'}</p>
              <button type="button" onClick={applyUpdate}>
                <RefreshCw size={15} aria-hidden="true" />
                {ar ? 'حدّث الآن' : 'Update now'}
              </button>
            </>
          )}
        </aside>
      ) : null}
    </PwaContext>
  );
}

export function PwaInstallButton({ locale }: { locale: Locale }) {
  const context = useContext(PwaContext);
  const dialog = useRef<HTMLDialogElement>(null);
  const [ios, setIos] = useState(false);
  const ar = locale === 'ar';

  async function handleInstall() {
    if (!context) return;
    const result = await context.install();
    if (result !== 'manual') return;
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    );
    dialog.current?.showModal();
  }

  if (!context || context.installed) return null;
  return (
    <>
      <button
        className="pwa-install-button"
        type="button"
        onClick={handleInstall}
        disabled={context.installing}
      >
        <Download size={14} aria-hidden="true" />
        {ar ? 'تثبيت أوريفا' : 'Install ORIVA'}
      </button>
      <dialog
        ref={dialog}
        className="pwa-install-dialog"
        aria-labelledby="pwa-install-title"
        aria-describedby="pwa-install-description"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="pwa-install-content">
          <button
            className="pwa-close"
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={ar ? 'إغلاق' : 'Close installation guide'}
            autoFocus
          >
            <X size={19} />
          </button>
          {/* The same identity is used on the device’s home screen. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={64} height={64} />
          <p className="pwa-install-eyebrow">ORIVA · {ar ? 'في متناول يدك' : 'A little closer'}</p>
          <h2 id="pwa-install-title">
            {ar ? 'مساحة لبدايتك القادمة. على شاشتك.' : 'Your next chapter. On your home screen.'}
          </h2>
          <p id="pwa-install-description">
            {ar
              ? 'افتح أوريفا كتطبيق مستقل، مباشرة من جهازك.'
              : 'Open ORIVA in its own window, straight from your device.'}
          </p>
          {ios ? (
            <ol>
              <li>
                {ar
                  ? 'افتح الموقع في Safari واضغط على المشاركة'
                  : 'Open this site in Safari and tap Share'}
                <Share2 size={16} aria-hidden="true" />.
              </li>
              <li>{ar ? 'اختر «إضافة إلى الشاشة الرئيسية».' : 'Choose “Add to Home Screen”.'}</li>
              <li>
                {ar
                  ? 'فعّل «فتح كتطبيق ويب» إذا ظهر، ثم اضغط «إضافة».'
                  : 'Keep “Open as Web App” enabled if shown, then tap “Add”.'}
              </li>
            </ol>
          ) : (
            <ol>
              <li>{ar ? 'افتح قائمة المتصفح.' : 'Open your browser’s menu.'}</li>
              <li>
                {ar
                  ? 'اختر «تثبيت أوريفا» أو «إضافة إلى الشاشة الرئيسية» أو «إضافة إلى Dock».'
                  : 'Choose “Install ORIVA”, “Add to Home Screen”, or “Add to Dock”.'}
              </li>
              <li>
                {ar
                  ? 'أكّد الإضافة. إذا لم يظهر الخيار، جرّب Chrome أو Safari.'
                  : 'Confirm. If the option is missing, try Chrome or Safari.'}
              </li>
            </ol>
          )}
          <button className="pwa-done" type="button" onClick={() => dialog.current?.close()}>
            {ar ? 'حسناً' : 'Got it'}
          </button>
        </div>
      </dialog>
    </>
  );
}
