'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring, useReducedMotion } from 'motion/react';
import { ArrowUpRight, ArrowUp, Sun, Moon, Menu, X, MoveUpRight } from 'lucide-react';
import type { Locale } from '@/lib/api';

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`brand${light ? ' brand-light' : ''}`} aria-label="ORIVA">
      <span className="brand-symbol" aria-hidden="true">
        <i />
        <b />
      </span>
      oriva<span className="brand-dot">®</span>
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
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 35,
    restDelta: 0.001,
  });
  const ar = locale === 'ar';
  const links = [
    { href: `/${locale}#story`, label: ar ? 'حكايتنا' : 'Our story' },
    { href: `/${locale}/properties`, label: ar ? 'العقارات' : 'Properties' },
    { href: `/${locale}/projects`, label: ar ? 'مشاريع جديدة' : 'New developments' },
    { href: `/${locale}/invest`, label: ar ? 'استثمر' : 'Invest' },
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
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [menuOpen]);
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
  const alternatePath = pathname.replace(/^\/(en|ar)(?=\/|$)/, ar ? '/en' : '/ar');
  return (
    <>
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
      <header className="site-header">
        <div className="header-inner">
          <Link
            className="brand-link"
            href={`/${locale}`}
            aria-label={ar ? 'أوريفا — الرئيسية' : 'ORIVA home'}
          >
            <Brand />
          </Link>
          <nav className="desktop-nav" aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'}>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href ? 'active' : ''}
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
              {ar ? 'لنتحدث' : 'Let’s talk'}
              <ArrowUpRight size={15} />
            </Link>
            <button
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
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              aria-label={ar ? 'التنقل على الهاتف' : 'Mobile navigation'}
            >
              {links.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                  {link.label}
                  <ArrowUpRight size={18} />
                </Link>
              ))}
              <Link href={`/${locale}/contact`} onClick={() => setMenuOpen(false)}>
                {ar ? 'تواصل معنا' : 'Get in touch'}
                <ArrowUpRight size={18} />
              </Link>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="container footer-top">
          <div>
            <p className="eyebrow">{ar ? 'مساحة لبداية جديدة' : 'ROOM FOR YOUR NEXT CHAPTER'}</p>
            <Link className="footer-invitation" href={`/${locale}/contact`}>
              {ar ? 'المستقبل يبدأ بمحادثة.' : 'The future starts\nwith a conversation.'}
              <span>
                <MoveUpRight />
              </span>
            </Link>
          </div>
          <div className="footer-mark">
            <Brand light />
            <p>{ar ? 'منظور جديد للحياة في الإمارات.' : 'A new perspective on UAE living.'}</p>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} ORIVA</span>
          <nav aria-label={ar ? 'روابط التذييل' : 'Footer links'}>
            <Link href={`/${locale}/properties`}>{ar ? 'اكتشف العقارات' : 'Discover homes'}</Link>
            <Link href={`/${locale}/contact`}>{ar ? 'تواصل معنا' : 'Contact us'}</Link>
            <Link href={`/${locale}/privacy`}>{ar ? 'الخصوصية' : 'Privacy'}</Link>
          </nav>
          <span className="demo-disclosure">
            {ar
              ? 'نسخة تجريبية · العقارات والأسعار توضيحية'
              : 'Demo experience · Illustrative properties & prices'}
          </span>
        </div>
      </footer>
      <AnimatePresence>
        {showTop && (
          <motion.button
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
    </>
  );
}
