'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight,
  BellRing,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  CircleHelp,
  ClipboardList,
  FileText,
  Globe2,
  ImageIcon,
  Layers3,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Settings2,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { Locale } from '@/lib/api';
import { AdminApiError, adminError, adminRequest, adminSessionExpired } from './admin-api';
import AdminOverview from './admin-overview';
import AdminRecords from './admin-records';
import AdminOperations from './admin-operations';
import AdminSiteContent from './admin-site-content';
import AdminAccount, { type AdminAccountUser } from './admin-account';
import './admin-shell.css';

const sections = [
  { id: 'overview', en: 'Overview', ar: 'نظرة عامة', group: 0, icon: LayoutDashboard },
  { id: 'listings', en: 'Properties', ar: 'العقارات', group: 1, icon: Building2 },
  { id: 'projects', en: 'Developments', ar: 'المشاريع', group: 1, icon: Layers3 },
  { id: 'areas', en: 'Areas', ar: 'المناطق', group: 1, icon: MapPin },
  { id: 'developers', en: 'Developers', ar: 'المطوّرون', group: 1, icon: Globe2 },
  { id: 'amenities', en: 'Amenities', ar: 'المرافق', group: 1, icon: ListChecks },
  { id: 'agents', en: 'Property advisors', ar: 'مستشارو العقارات', group: 1, icon: UserRound },
  { id: 'site-content', en: 'Website content', ar: 'محتوى الموقع', group: 2, icon: FileText },
  { id: 'articles', en: 'Articles & guides', ar: 'المقالات والأدلة', group: 2, icon: BookOpen },
  { id: 'media', en: 'Media library', ar: 'مكتبة الصور', group: 2, icon: ImageIcon },
  { id: 'leads', en: 'Enquiries', ar: 'الاستفسارات', group: 3, icon: BellRing },
  { id: 'conversations', en: 'QA conversations', ar: 'محادثات QA', group: 3, icon: MessageSquare },
  { id: 'team', en: 'The team', ar: 'الفريق', group: 3, icon: Users },
  { id: 'users', en: 'Users & access', ar: 'المستخدمون والصلاحيات', group: 3, icon: ShieldCheck },
  { id: 'audit', en: 'Activity log', ar: 'سجل النشاط', group: 4, icon: ClipboardList },
  { id: 'account', en: 'My account', ar: 'حسابي', group: 4, icon: Settings2 },
] as const;
type Section = (typeof sections)[number]['id'];
const groups = [
  ['YOUR WORKSPACE', 'مساحتك'],
  ['THE PORTFOLIO', 'المحفظة'],
  ['THE WEBSITE', 'الموقع'],
  ['THE PEOPLE', 'الناس'],
  ['SETTINGS', 'الإعدادات'],
] as const;
const sectionIds = new Set<string>(sections.map((section) => section.id));
const isSection = (value: string): value is Section => sectionIds.has(value);

export default function AdminWorkspace({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const router = useRouter();
  const reduced = useReducedMotion();
  const [section, setSection] = useState<Section>('overview');
  const [user, setUser] = useState<AdminAccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutFailure, setLogoutFailure] = useState<unknown>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const expired = () => {
      setUser(null);
      router.replace(`/${locale}/admin/login?session=expired`);
    };
    window.addEventListener(adminSessionExpired, expired);
    return () => window.removeEventListener(adminSessionExpired, expired);
  }, [locale, router]);
  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.slice(1);
      if (isSection(hash)) setSection(hash);
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, [locale]);
  useEffect(() => {
    const update = () => setDark(document.documentElement.dataset.theme === 'dark');
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailure(null);
    void adminRequest<{ user: AdminAccountUser }>('/session', { signal: controller.signal })
      .then((session) => {
        if (controller.signal.aborted) return;
        if (session.user.role !== 'ADMIN')
          throw new AdminApiError(403, 'Administrator access is required.');
        setUser(session.user);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof AdminApiError && error.status === 401)
          router.replace(`/${locale}/admin/login`);
        else setFailure(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [locale, router, attempt]);
  useEffect(() => {
    const dialog = drawer.current;
    if (!dialog) return;
    if (menuOpen && !dialog.open) dialog.showModal();
    else if (!menuOpen && dialog.open) dialog.close();
  }, [menuOpen]);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1051px)');
    const resized = () => {
      if (query.matches) setMenuOpen(false);
    };
    query.addEventListener('change', resized);
    return () => query.removeEventListener('change', resized);
  }, []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [section]);

  function navigate(value: string) {
    if (!isSection(value)) return;
    setSection(value);
    setMenuOpen(false);
    window.history.replaceState(null, '', `#${value}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function theme() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
    try {
      localStorage.setItem('oriva-theme', next ? 'dark' : 'light');
    } catch {
      /* Theme remains available without persistent storage. */
    }
  }
  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutFailure(null);
    try {
      await adminRequest('/auth/logout', { method: 'POST' });
      router.replace(`/${locale}/admin/login`);
      router.refresh();
    } catch (error) {
      setLogoutFailure(error);
      setLoggingOut(false);
    }
  }

  const current = sections.find((item) => item.id === section)!;
  function navigation() {
    return (
      <nav
        className="admin-navigation"
        aria-label={ar ? 'أقسام الإدارة' : 'Administration sections'}
      >
        {groups.map((group, index) => (
          <div className="admin-nav-group" key={group[0]}>
            <p>{group[ar ? 1 : 0]}</p>
            {sections
              .filter((item) => item.group === index)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={section === item.id ? 'is-active' : ''}
                  aria-current={section === item.id ? 'page' : undefined}
                  onClick={() => navigate(item.id)}
                >
                  <item.icon size={17} />
                  <span>{ar ? item.ar : item.en}</span>
                  {section === item.id ? <i aria-hidden="true" /> : null}
                </button>
              ))}
          </div>
        ))}
      </nav>
    );
  }
  function userCard() {
    return user ? (
      <div className="admin-sidebar-user">
        <span className="admin-avatar">
          {user.firstName.slice(0, 1)}
          {user.lastName.slice(0, 1)}
        </span>
        <div>
          <strong>
            {user.firstName} {user.lastName}
          </strong>
          <span>{ar ? 'مدير النظام' : 'Administrator'}</span>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          aria-label={ar ? 'تسجيل الخروج' : 'Sign out'}
        >
          <LogOut size={17} />
        </button>
      </div>
    ) : null;
  }
  function content() {
    switch (section) {
      case 'overview':
        return <AdminOverview locale={locale} onNavigate={navigate} />;
      case 'site-content':
        return <AdminSiteContent locale={locale} />;
      case 'account':
        return user ? <AdminAccount user={user} locale={locale} /> : null;
      case 'listings':
      case 'projects':
      case 'articles':
      case 'areas':
      case 'developers':
      case 'amenities':
      case 'agents':
      case 'media':
        return <AdminRecords section={section} locale={locale} />;
      default:
        return <AdminOperations section={section} locale={locale} />;
    }
  }
  if (loading)
    return (
      <main className="admin-root admin-session-screen" id="main" aria-busy="true">
        <span className="admin-wordmark">
          oriva<span>®</span>
        </span>
        <span className="admin-session-spinner" />
        <p>{ar ? 'جارٍ تجهيز مساحة الإدارة…' : 'Preparing your workspace…'}</p>
      </main>
    );
  if (failure || !user)
    return (
      <main className="admin-root admin-session-screen" id="main">
        <div className="admin-card admin-access-state">
          <CircleHelp size={30} />
          <p className="admin-eyebrow">ORIVA / ADMIN</p>
          <h1>
            {failure instanceof AdminApiError && failure.status === 403
              ? ar
                ? 'الوصول غير متاح.'
                : 'Access is not available.'
              : ar
                ? 'توقف قصير.'
                : 'A little pause.'}
          </h1>
          <p className="admin-muted">
            {failure
              ? adminError(failure, locale)
              : ar
                ? 'يرجى تسجيل الدخول إلى الإدارة.'
                : 'Please sign in to administration.'}
          </p>
          <div className="admin-inline-actions">
            <button
              className="admin-button admin-button-primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              {ar ? 'حاول مجدداً' : 'Try again'}
            </button>
            <Link className="admin-button" href={`/${locale}/admin/login`}>
              {ar ? 'تسجيل الدخول' : 'Sign in'}
            </Link>
            <Link className="admin-text-button" href={`/${locale}`}>
              {ar ? 'عرض الموقع' : 'View website'}
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </main>
    );
  return (
    <div className="admin-root admin-workspace" dir={ar ? 'rtl' : 'ltr'}>
      <a className="admin-skip-link" href="#admin-content">
        {ar ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <Link href={`/${locale}`} className="admin-wordmark">
            oriva<span>®</span>
          </Link>
          <span>ADMIN STUDIO</span>
        </div>
        {navigation()}
        <div className="admin-sidebar-site">
          <Link href={`/${locale}`}>
            <Globe2 size={16} />
            {ar ? 'عرض الموقع' : 'View website'}
            <ArrowUpRight size={14} />
          </Link>
        </div>
        {userCard()}
      </aside>
      <dialog
        ref={drawer}
        className="admin-drawer"
        onClose={() => setMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setMenuOpen(false);
        }}
        aria-label={ar ? 'قائمة الإدارة' : 'Administration menu'}
      >
        <div className="admin-drawer-header">
          <span className="admin-wordmark">
            oriva<span>®</span>
          </span>
          <button
            type="button"
            className="admin-drawer-close"
            onClick={() => setMenuOpen(false)}
            aria-label={ar ? 'إغلاق القائمة' : 'Close menu'}
          >
            <X size={21} />
          </button>
        </div>
        {navigation()}
        {userCard()}
      </dialog>
      <div className="admin-body">
        <header className="admin-topbar">
          <div className="admin-topbar-breadcrumb">
            <button
              className="admin-mobile-menu"
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label={ar ? 'فتح القائمة' : 'Open menu'}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
            >
              <Menu size={21} />
            </button>
            <span className="admin-topbar-mark">
              <ChartNoAxesCombined size={17} />
            </span>
            <span>{ar ? 'مساحة الإدارة' : 'Admin studio'}</span>
            <span>/</span>
            <strong>{ar ? current.ar : current.en}</strong>
          </div>
          <div className="admin-topbar-actions">
            <Link
              className="admin-language-link"
              href={`/${ar ? 'en' : 'ar'}/admin#${section}`}
              lang={ar ? 'en' : 'ar'}
            >
              {ar ? 'EN' : 'عربي'}
            </Link>
            <button
              className="admin-icon-button"
              type="button"
              onClick={theme}
              aria-pressed={dark}
              aria-label={
                dark
                  ? ar
                    ? 'تفعيل الوضع الفاتح'
                    : 'Switch to light mode'
                  : ar
                    ? 'تفعيل الوضع الداكن'
                    : 'Switch to dark mode'
              }
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link className="admin-site-link" href={`/${locale}`}>
              {ar ? 'الموقع' : 'Live website'}
              <ArrowUpRight size={14} />
            </Link>
            <span className="admin-topbar-avatar" aria-label={`${user.firstName} ${user.lastName}`}>
              {user.firstName.slice(0, 1)}
              {user.lastName.slice(0, 1)}
            </span>
          </div>
        </header>
        <main className="admin-main" id="admin-content" tabIndex={-1}>
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">ORIVA / {ar ? 'الإدارة' : 'ADMINISTRATION'}</p>
              <h1 ref={heading} tabIndex={-1}>
                {ar ? current.ar : current.en}
                <span>.</span>
              </h1>
            </div>
            <span className="admin-protected-label">
              <ShieldCheck size={15} />
              {ar ? 'مساحة إدارة آمنة' : 'Private management space'}
            </span>
          </div>
          {logoutFailure ? (
            <div className="admin-alert admin-alert-error" role="alert">
              {adminError(logoutFailure, locale)}
              <button
                type="button"
                className="admin-text-button"
                onClick={logout}
                disabled={loggingOut}
              >
                {ar ? 'إعادة تسجيل الخروج' : 'Retry sign out'}
              </button>
            </div>
          ) : null}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              initial={reduced ? false : { opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: reduced ? 0 : 0.18 }}
            >
              {content()}
            </motion.div>
          </AnimatePresence>
          <footer className="admin-workspace-footer">
            <span>ORIVA / {ar ? 'كل تفصيل يصنع فرقاً.' : 'EVERY DETAIL MAKES A DIFFERENCE.'}</span>
            <span>
              {ar ? 'من الإمارات، إلى ما هو أبعد.' : 'FROM THE EMIRATES, LOOKING FURTHER.'}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
