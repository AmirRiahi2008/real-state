'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring, useReducedMotion } from 'motion/react';
import { ArrowUpRight, ArrowUp, Sun, Moon, Menu, X, MoveUpRight } from 'lucide-react';
import type { Locale } from '@/lib/api';
import { ExperienceLoader, PageEntry } from './page-experience';
import { useSiteText } from './site-content-provider';
import { NavUaeFlag } from './nav-uae-flag';
import { PwaInstallButton } from './pwa-experience';

export function Brand({ light = false }: { light?: boolean }) {
  const locale = usePathname().startsWith('/ar') ? 'ar' : 'en';
  const text = useSiteText(locale);
  const name = text('site.name', 'ORIVA') || 'ORIVA';
  return (
    <span className={`brand${light ? ' brand-light' : ''}`} aria-label={name}>
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <b />
      </span>
      {name.toLowerCase()}
      <span className="brand-dot">®</span>
    </span>
  );
}
export default function SiteShell({
  locale: initialLocale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const locale: Locale = pathname.startsWith('/ar')
    ? 'ar'
    : pathname.startsWith('/en')
      ? 'en'
      : initialLocale;
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 35,
    restDelta: 0.001,
  });
  const ar = locale === 'ar';
  const staffWorkspace = /^\/(en|ar)\/dashboard(?:\/|$)/.test(pathname);
  const text = useSiteText(locale);
  const links = [
    { href: `/${locale}#story`, label: text('site.navStory', ar ? 'حكايتنا' : 'Our story') },
    {
      href: `/${locale}/properties`,
      label: text('site.navProperties', ar ? 'العقارات' : 'Properties'),
    },
    {
      href: `/${locale}/projects`,
      label: text('site.navProjects', ar ? 'مشاريع جديدة' : 'New developments'),
    },
    { href: `/${locale}/invest`, label: text('site.navInvest', ar ? 'استثمر' : 'Invest') },
    { href: `/${locale}/qa`, label: text('site.navQa', ar ? 'اسأل فريقنا' : 'QA') },
  ];
  useEffect(() => {
    setDark(document.documentElement.dataset.theme === 'dark');
  }, []);
  useEffect(() => {
    setMenuOpen(false);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [pathname, locale]);
  useEffect(() => {
    const listener = () => setShowTop(window.scrollY > 800);
    window.addEventListener('scroll', listener, { passive: true });
    return () => window.removeEventListener('scroll', listener);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target))
        setMenuOpen(false);
    };
    const desktop = window.matchMedia(`(min-width: ${staffWorkspace ? 801 : 1081}px)`);
    const dismissOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    document.addEventListener('pointerdown', dismissOutside);
    desktop.addEventListener('change', dismissOnDesktop);
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('pointerdown', dismissOutside);
      desktop.removeEventListener('change', dismissOnDesktop);
    };
  }, [menuOpen, staffWorkspace]);
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try {
      localStorage.setItem('oriva-theme', next ? 'dark' : 'light');
    } catch {
      /* Private browsing may disable storage. */
    }
  }
  if (/^\/(en|ar)\/admin(?:\/|$)/.test(pathname)) return <PageEntry>{children}</PageEntry>;
  const alternatePath = pathname.replace(/^\/(en|ar)(?=\/|$)/, ar ? '/en' : '/ar');
  const isActive = (href: string) =>
    !href.includes('#') && (pathname === href || pathname.startsWith(`${href}/`));
  return (
    <div className={staffWorkspace ? undefined : 'public-site'}>
      <a className="skip-link" href="#main">
        {ar ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      <div className="reading-progress" aria-hidden="true">
        <motion.div
          data-testid="reading-progress"
          style={{
            scaleX: reduced ? scrollYProgress : smoothProgress,
            transformOrigin: ar ? 'right' : 'left',
          }}
        />
      </div>
      <header
        ref={header}
        className="site-header"
        onBlur={(event) => {
          if (menuOpen && !event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
        }}
      >
        <div className="header-inner">
          <Link
            className="brand-link"
            href={`/${locale}`}
            aria-label={ar ? 'أوريفا — الرئيسية' : 'ORIVA home'}
          >
            <Brand />
            {!staffWorkspace ? <NavUaeFlag /> : null}
          </Link>
          <nav className="desktop-nav" aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={isActive(link.href) ? 'active' : ''}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link
              className="language-switch"
              href={alternatePath}
              lang={ar ? 'en' : 'ar'}
              aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              {ar ? 'EN' : 'عربي'}
            </Link>
            <span className="header-divider" />
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              aria-label={
                dark
                  ? ar
                    ? 'تفعيل الوضع الفاتح'
                    : 'Switch to light mode'
                  : ar
                    ? 'تفعيل الوضع الداكن'
                    : 'Switch to dark mode'
              }
              aria-pressed={dark}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link
              className="button button-small button-dark header-cta"
              href={`/${locale}/contact`}
            >
              {text('site.contactCta', ar ? 'لنتحدث' : 'Let’s talk')}
              <ArrowUpRight size={15} />
            </Link>
            <button
              ref={menuButton}
              type="button"
              className="icon-button mobile-menu-button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={ar ? 'فتح القائمة' : 'Toggle menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.nav
              id="mobile-navigation"
              className="mobile-nav"
              initial={reduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: reduced ? 0 : 0.25, ease: 'easeInOut' }}
              aria-label={ar ? 'التنقل على الهاتف' : 'Mobile navigation'}
            >
              {links.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={isActive(link.href) ? 'active' : ''}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                >
                  {!staffWorkspace ? (
                    <span className="mobile-nav-number" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  ) : null}
                  {link.label}
                  <ArrowUpRight size={18} />
                </Link>
              ))}
              <Link
                className="mobile-nav-contact"
                href={`/${locale}/contact`}
                onClick={() => setMenuOpen(false)}
              >
                {ar ? 'تواصل معنا' : 'Get in touch'}
                <ArrowUpRight size={18} />
              </Link>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
      <main id="main" tabIndex={-1}>
        <PageEntry>{children}</PageEntry>
      </main>
      <ExperienceLoader locale={locale} />
      <footer className="site-footer">
        <div className="container footer-top">
          <div>
            <p className="eyebrow">
              {text('footer.eyebrow', ar ? 'مساحة لبداية جديدة' : 'ROOM FOR YOUR NEXT CHAPTER')}
            </p>
            <Link className="footer-invitation" href={`/${locale}/contact`}>
              {text(
                'footer.title',
                ar ? 'المستقبل يبدأ بمحادثة.' : 'The future starts\nwith a conversation.',
              )}
              <span>
                <MoveUpRight />
              </span>
            </Link>
          </div>
          <div className="footer-mark">
            <Brand light />
            <p>
              {text(
                'footer.description',
                ar ? 'منظور جديد للحياة في الإمارات.' : 'A new perspective on UAE living.',
              )}
            </p>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>
            © {new Date().getFullYear()} {text('site.name', 'ORIVA')}
          </span>
          <nav aria-label={ar ? 'روابط التذييل' : 'Footer links'}>
            <Link href={`/${locale}/properties`}>{ar ? 'اكتشف العقارات' : 'Discover homes'}</Link>
            <Link href={`/${locale}/contact`}>{ar ? 'تواصل معنا' : 'Contact us'}</Link>
            <Link href={`/${locale}/privacy`}>{ar ? 'الخصوصية' : 'Privacy'}</Link>
            <Link href={`/${locale}/insights`}>{ar ? 'رؤى وأدلة' : 'Insights'}</Link>
            <PwaInstallButton locale={locale} />
            <Link href={`/${locale}/dashboard/login`}>{ar ? 'دخول الفريق' : 'Team sign in'}</Link>
            <Link href={`/${locale}/admin/login`}>{ar ? 'إدارة الموقع' : 'Administration'}</Link>
          </nav>
          <span className="demo-disclosure">
            {text(
              'footer.disclosure',
              ar
                ? 'نسخة تجريبية · العقارات والأسعار توضيحية'
                : 'Demo experience · Illustrative properties & prices',
            )}
          </span>
        </div>
      </footer>
      <AnimatePresence>
        {showTop && (
          <motion.button
            type="button"
            className="back-to-top"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' })}
            aria-label={ar ? 'العودة إلى الأعلى' : 'Back to top'}
          >
            <ArrowUp size={19} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
