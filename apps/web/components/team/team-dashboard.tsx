'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ImagePlus,
  Inbox,
  LockKeyhole,
  LogOut,
  MessageCircle,
  RefreshCw,
  Save,
  Send,
  UserRound,
} from 'lucide-react';
import type { Locale } from '@/lib/api';
import type {
  OwnTeamProfile,
  TeamConversation,
  TeamMessage,
  TeamPage,
  TeamSession,
  TeamInboxConversation,
} from '@/lib/team-types';
import { announceProfileUpdate, isAbort, teamError, teamRequest, TeamApiError } from './team-api';
import MemberAvatar from './member-avatar';
import { MessageList, ThreadHeading } from './message-list';
import { useConversation } from './use-conversation';
import './team.css';

type Tab = 'inbox' | 'profile' | 'security';
export default function TeamDashboard({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const router = useRouter();
  const [session, setSession] = useState<TeamSession | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tab, setTab] = useState<Tab>('inbox');
  const [loggingOut, setLoggingOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    void teamRequest<TeamSession>('/session', { signal: controller.signal })
      .then(setSession)
      .catch((failure) => {
        if (isAbort(failure)) return;
        if (failure instanceof TeamApiError && failure.status === 401) {
          setSession(null);
          router.replace(`/${locale}/dashboard/login`);
        } else setError(failure);
      });
    return () => controller.abort();
  }, [attempt, locale, router]);
  useEffect(() => {
    if (!session) return;
    const userId = session.user.id;
    let controller: AbortController | null = null;
    const check = () => {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      void teamRequest<TeamSession>('/session', { signal: controller.signal })
        .then((next) => {
          if (next.user.id !== userId) {
            setSession(null);
            router.refresh();
            setAttempt((value) => value + 1);
          }
        })
        .catch((failure) => {
          if (!isAbort(failure) && failure instanceof TeamApiError && failure.status === 401) {
            setSession(null);
            router.replace(`/${locale}/dashboard/login`);
          }
        });
    };
    document.addEventListener('visibilitychange', check);
    return () => {
      controller?.abort();
      document.removeEventListener('visibilitychange', check);
    };
  }, [session?.user.id, locale, router]);
  async function logout() {
    setLoggingOut(true);
    setError(null);
    try {
      await teamRequest<void>('/auth/logout', { method: 'POST' });
      setSession(null);
      router.replace(`/${locale}/dashboard/login`);
      router.refresh();
    } catch (failure) {
      setError(failure);
      setLoggingOut(false);
    }
  }
  if (!session)
    return (
      <div className="team-dashboard-loading container">
        {error ? (
          <>
            <p role="alert">{teamError(error, locale)}</p>
            <button
              className="button button-primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              {ar ? 'حاول مجدداً' : 'Try again'}
            </button>
            <Link className="team-inline-link" href={`/${locale}/dashboard/login`}>
              {ar ? 'تسجيل الدخول' : 'Sign in'}
            </Link>
          </>
        ) : (
          <>
            <span className="team-spinner" />
            <p role="status">{ar ? 'جارٍ فتح مساحتك…' : 'Opening your workspace…'}</p>
          </>
        )}
      </div>
    );
  const tabs = [
    { id: 'inbox' as const, label: ar ? 'الرسائل' : 'Conversations', icon: Inbox },
    { id: 'profile' as const, label: ar ? 'ملفي الشخصي' : 'My profile', icon: UserRound },
    { id: 'security' as const, label: ar ? 'كلمة المرور' : 'Password', icon: LockKeyhole },
  ];
  return (
    <div className="team-dashboard-page">
      <div className="container">
        <header className="team-dashboard-heading">
          <div>
            <p className="eyebrow">
              <span className="status-dot" />
              {ar ? 'مساحتك الشخصية' : 'YOUR PERSONAL WORKSPACE'}
            </p>
            <h1>
              {ar ? 'مرحباً، ' : 'Hello, '}
              <em>{session.profile.displayName.split(' ')[0]}.</em>
            </h1>
            <p>
              {ar
                ? 'أحاديث تستحق وقتك. وملف يعكس شخصيتك.'
                : 'Conversations worth your time. A profile that feels like you.'}
            </p>
          </div>
          <Link className="team-inline-link" href={`/${locale}/qa`}>
            {ar ? 'عرض صفحة QA' : 'View QA page'}
            <ArrowUpRight size={17} />
          </Link>
        </header>
        <div className="team-workspace">
          <aside className="team-workspace-sidebar">
            <div className="team-workspace-identity">
              <MemberAvatar member={session.profile} key={session.profile.photoUrl} />
              <h2>{session.profile.displayName}</h2>
              <p>
                {ar ? session.profile.titleAr || session.profile.titleEn : session.profile.titleEn}
              </p>
              <span>{session.user.email}</span>
            </div>
            <nav aria-label={ar ? 'التنقل في مساحتك' : 'Workspace navigation'}>
              {tabs.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    aria-current={tab === item.id ? 'page' : undefined}
                    className={tab === item.id ? 'is-active' : ''}
                  >
                    <Icon size={18} />
                    {item.label}
                    {tab === item.id ? <span /> : null}
                  </button>
                );
              })}
            </nav>
            <div className="team-workspace-access">
              <LockKeyhole size={15} />
              <p>
                {ar
                  ? 'ملفك ورسائلك الخاصة. إدارة محتوى الموقع غير متاحة هنا.'
                  : 'Your profile and your private inbox. Site content management is not part of this workspace.'}
              </p>
            </div>
            <button
              className="team-logout-button"
              onClick={() => void logout()}
              disabled={loggingOut}
            >
              <LogOut size={17} />
              {loggingOut
                ? ar
                  ? 'جارٍ الخروج…'
                  : 'Signing out…'
                : ar
                  ? 'تسجيل الخروج'
                  : 'Sign out'}
            </button>
          </aside>
          <div className="team-workspace-main">
            {error ? (
              <p className="team-inline-error" role="alert">
                {teamError(error, locale)}
              </p>
            ) : null}
            {tab === 'inbox' ? (
              <TeamInbox key={session.user.id} locale={locale} profile={session.profile} />
            ) : tab === 'profile' ? (
              <ProfileEditor
                key={session.user.id}
                locale={locale}
                profile={session.profile}
                onChange={(profile) =>
                  setSession((previous) => (previous ? { ...previous, profile } : previous))
                }
              />
            ) : (
              <PasswordEditor
                locale={locale}
                onComplete={() => {
                  setSession(null);
                  router.replace(`/${locale}/dashboard/login?password=changed`);
                  router.refresh();
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileEditor({
  locale,
  profile,
  onChange,
}: {
  locale: Locale;
  profile: OwnTeamProfile;
  onChange: (profile: OwnTeamProfile) => void;
}) {
  const ar = locale === 'ar';
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploading) return;
    setPending(true);
    setError(null);
    setSaved(false);
    const values = new FormData(event.currentTarget);
    const data = Object.fromEntries(
      ['displayName', 'titleEn', 'titleAr', 'bioEn', 'bioAr'].map((key) => [
        key,
        String(values.get(key) || '').trim(),
      ]),
    );
    try {
      onChange(
        await teamRequest<OwnTeamProfile>('/me', { method: 'PATCH', body: JSON.stringify(data) }),
      );
      announceProfileUpdate();
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  async function photo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || uploading) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get('file');
    if (!(file instanceof File) || file.size === 0) return;
    setError(null);
    setSaved(false);
    if (file.size > 4 * 1024 * 1024) {
      setError(new TeamApiError(413, 'Choose a photo under 4 MB.'));
      return;
    }
    setUploading(true);
    try {
      onChange(await teamRequest<OwnTeamProfile>('/me/photo', { method: 'POST', body: data }));
      announceProfileUpdate();
      form.reset();
      setSaved(true);
    } catch (failure) {
      setError(failure);
    } finally {
      setUploading(false);
    }
  }
  return (
    <section className="team-editor-section">
      <div className="team-panel-heading">
        <span className="team-card-icon">
          <UserRound size={22} />
        </span>
        <div>
          <p className="team-section-label">{ar ? 'حضورك، بطريقتك' : 'YOUR PRESENCE. YOUR WAY.'}</p>
          <h2>{ar ? 'ملفك الشخصي.' : 'Your public profile.'}</h2>
        </div>
      </div>
      <p className="team-panel-intro">
        {ar
          ? 'تظهر الصورة والاسم والمسمّى والتعريف هنا وفي صفحة QA. المسمّى وصفٌ لدورك ولا يغيّر صلاحيات حسابك.'
          : 'Your photo, name, title and introduction appear on QA. Your title describes what you do; it does not change your account permissions.'}
      </p>
      <form className="team-photo-editor" onSubmit={photo}>
        <MemberAvatar member={profile} key={profile.photoUrl} />
        <div>
          <label className="team-field">
            {ar ? 'صورة الملف الشخصي' : 'Profile photo'}
            <input type="file" name="file" accept="image/jpeg,image/png,image/webp" required />
          </label>
          <p>{ar ? 'JPEG أو PNG أو WebP، حتى ٤ ميغابايت.' : 'JPEG, PNG or WebP. Up to 4 MB.'}</p>
          <button className="team-inline-link" type="submit" disabled={uploading || pending}>
            <ImagePlus size={16} />
            {uploading
              ? ar
                ? 'جارٍ رفع الصورة…'
                : 'Uploading photo…'
              : ar
                ? 'تحديث الصورة'
                : 'Update photo'}
          </button>
        </div>
      </form>
      <form className="team-profile-form" onSubmit={save}>
        <label className="team-field">
          {ar ? 'الاسم المعروض' : 'Display name'}
          <input
            name="displayName"
            defaultValue={profile.displayName}
            minLength={2}
            maxLength={160}
            required
            autoComplete="name"
          />
        </label>
        <div className="team-field-grid">
          <label className="team-field">
            {ar ? 'المسمّى بالإنجليزية' : 'Title in English'}
            <input
              name="titleEn"
              defaultValue={profile.titleEn}
              minLength={2}
              maxLength={80}
              required
              dir="ltr"
            />
          </label>
          <label className="team-field">
            {ar ? 'المسمّى بالعربية' : 'Title in Arabic'}
            <input
              name="titleAr"
              defaultValue={profile.titleAr}
              minLength={2}
              maxLength={80}
              required
              dir="rtl"
            />
          </label>
        </div>
        <div className="team-field-grid">
          <div className="team-field">
            <label htmlFor="team-profile-bio-en">
              {ar ? 'نبذة بالإنجليزية' : 'Introduction in English'}
            </label>
            <textarea
              id="team-profile-bio-en"
              name="bioEn"
              defaultValue={profile.bioEn}
              maxLength={2000}
              rows={6}
              dir="ltr"
            />
          </div>
          <div className="team-field">
            <label htmlFor="team-profile-bio-ar">
              {ar ? 'نبذة بالعربية' : 'Introduction in Arabic'}
            </label>
            <textarea
              id="team-profile-bio-ar"
              name="bioAr"
              defaultValue={profile.bioAr}
              maxLength={2000}
              rows={6}
              dir="rtl"
            />
          </div>
        </div>
        {error ? (
          <p className="team-form-error" role="alert">
            {teamError(error, locale)}
          </p>
        ) : null}
        <div className="team-editor-footer">
          <p className="team-save-status" role="status">
            {saved ? (
              <>
                <Check size={16} />
                {ar
                  ? 'تم التحديث. يظهر ملفك الجديد في QA.'
                  : 'Updated. Your new profile is visible on QA.'}
              </>
            ) : null}
          </p>
          <button className="button button-primary" type="submit" disabled={pending || uploading}>
            {pending ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : ar ? 'حفظ التغييرات' : 'Save changes'}
            <Save size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordEditor({ locale, onComplete }: { locale: Locale; onComplete: () => void }) {
  const ar = locale === 'ar';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [mismatch, setMismatch] = useState(false);
  async function change(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const currentPassword = String(data.get('currentPassword') || ''),
      newPassword = String(data.get('newPassword') || '');
    if (newPassword !== String(data.get('confirmation') || '')) {
      setMismatch(true);
      return;
    }
    setPending(true);
    setError(null);
    setMismatch(false);
    try {
      await teamRequest<void>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      onComplete();
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="team-editor-section team-security-section">
      <div className="team-panel-heading">
        <span className="team-card-icon">
          <LockKeyhole size={22} />
        </span>
        <div>
          <p className="team-section-label">
            {ar ? 'حافظ على خصوصية مساحتك' : 'KEEP YOUR SPACE PERSONAL'}
          </p>
          <h2>{ar ? 'كلمة مرور جديدة.' : 'A fresh password.'}</h2>
        </div>
      </div>
      <p className="team-panel-intro">
        {ar
          ? 'اختر كلمة مرور مختلفة من ١٢ إلى ١٢٨ حرفاً. بعد تغييرها ستسجّل الدخول مجدداً لحماية حسابك.'
          : 'Choose a different password between 12 and 128 characters. After changing it, you’ll sign in again to keep your account protected.'}
      </p>
      <form className="team-password-form" onSubmit={change}>
        <label className="team-field">
          {ar ? 'كلمة المرور الحالية' : 'Current password'}
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>
        <label className="team-field">
          {ar ? 'كلمة المرور الجديدة' : 'New password'}
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <label className="team-field">
          {ar ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        {mismatch ? (
          <p className="team-form-error" role="alert">
            {ar ? 'كلمتا المرور الجديدتان غير متطابقتين.' : 'The new passwords do not match.'}
          </p>
        ) : null}
        {error ? (
          <p className="team-form-error" role="alert">
            {error instanceof TeamApiError && error.status === 401
              ? ar
                ? 'تحقق من كلمة المرور الحالية أو سجّل الدخول مجدداً.'
                : 'Check your current password, or sign in again.'
              : teamError(error, locale)}
          </p>
        ) : null}
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending
            ? ar
              ? 'جارٍ التحديث…'
              : 'Updating…'
            : ar
              ? 'تحديث كلمة المرور'
              : 'Update password'}
          <LockKeyhole size={16} />
        </button>
      </form>
    </section>
  );
}

function TeamInbox({ locale, profile }: { locale: Locale; profile: OwnTeamProfile }) {
  const ar = locale === 'ar';
  const [threads, setThreads] = useState<TeamInboxConversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let controller: AbortController | null = null;
    setLoading(true);
    setError(null);
    setThreads([]);
    setActive(null);
    const load = async () => {
      if (stopped || inFlight || document.hidden) return;
      inFlight = true;
      controller = new AbortController();
      try {
        const result = await teamRequest<TeamPage<TeamInboxConversation>>(
          `/inbox?page=${page}&limit=15`,
          { signal: controller.signal },
        );
        if (!stopped) {
          setThreads(result.data);
          setTotalPages(result.meta?.totalPages || 1);
          setError(null);
        }
      } catch (failure) {
        if (!stopped && !isAbort(failure)) setError(failure);
      } finally {
        inFlight = false;
        if (!stopped) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 8000);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      stopped = true;
      clearInterval(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', visible);
    };
  }, [page, attempt]);
  if (active)
    return (
      <InboxThread
        key={active}
        id={active}
        locale={locale}
        profile={profile}
        onBack={() => {
          setActive(null);
          setAttempt((value) => value + 1);
        }}
      />
    );
  return (
    <section className="team-inbox-section">
      <div className="team-panel-heading">
        <span className="team-card-icon">
          <Inbox size={22} />
        </span>
        <div>
          <p className="team-section-label">
            {ar ? 'أسئلة تنتظر صوتك' : 'QUESTIONS WAITING FOR YOUR VOICE'}
          </p>
          <h2>{ar ? 'صندوق المحادثات.' : 'Your conversations.'}</h2>
        </div>
        <button
          className="team-round-button"
          onClick={() => setAttempt((value) => value + 1)}
          aria-label={ar ? 'تحديث المحادثات' : 'Refresh conversations'}
        >
          <RefreshCw size={17} />
        </button>
      </div>
      <p className="team-panel-intro">
        {ar
          ? 'الرسائل المرسلة إليك فقط، في مساحة واحدة. تظهر المحادثات الجديدة تلقائياً.'
          : 'Only the conversations addressed to you, together in one place. New messages appear automatically.'}
      </p>
      {loading ? (
        <p className="team-loading-copy" role="status">
          {ar ? 'جارٍ تحميل المحادثات…' : 'Loading conversations…'}
        </p>
      ) : error ? (
        <div className="team-empty-state">
          <p role="alert">{teamError(error, locale)}</p>
          <Link className="team-inline-link" href={`/${locale}/dashboard/login`}>
            {ar ? 'تسجيل الدخول مجدداً' : 'Sign in again'}
          </Link>
        </div>
      ) : threads.length ? (
        <>
          <div className="team-inbox-list">
            {threads.map((thread) => (
              <button
                key={thread.id}
                className="team-inbox-row"
                onClick={() => setActive(thread.id)}
              >
                <span className="team-visitor-avatar">{thread.name.slice(0, 1).toUpperCase()}</span>
                <span className="team-inbox-preview">
                  <strong>{thread.name}</strong>
                  <span>
                    {thread.lastMessage?.body || (ar ? 'افتح المحادثة' : 'Open conversation')}
                  </span>
                  <small>{thread.email}</small>
                </span>
                <span className="team-inbox-date">
                  {new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-AE', {
                    month: 'short',
                    day: 'numeric',
                  }).format(new Date(thread.updatedAt))}
                  <ArrowUpRight size={17} />
                </span>
              </button>
            ))}
          </div>
          <div className="team-pagination">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              {ar ? 'السابق' : 'Previous'}
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
              {ar ? 'التالي' : 'Next'}
            </button>
          </div>
        </>
      ) : (
        <div className="team-empty-state">
          <MessageCircle size={35} />
          <h3>{ar ? 'مساحة لحديث قادم.' : 'Room for the next conversation.'}</h3>
          <p>
            {ar
              ? 'عندما يراسلك أحد من QA، ستظهر محادثته هنا.'
              : 'When someone messages you from QA, their conversation will appear here.'}
          </p>
        </div>
      )}
    </section>
  );
}

function InboxThread({
  id,
  locale,
  profile,
  onBack,
}: {
  id: string;
  locale: Locale;
  profile: OwnTeamProfile;
  onBack: () => void;
}) {
  const ar = locale === 'ar';
  const { thread, loading, error, loadOlder, olderLoading, appendMessage } = useConversation(
    `/inbox/${id}`,
  );
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);
  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') || '').trim();
    if (!body) return;
    setPending(true);
    setSendError(null);
    setSent(false);
    try {
      const result = await teamRequest<{ message: TeamMessage; updatedAt: string }>(
        `/inbox/${id}/replies`,
        { method: 'POST', body: JSON.stringify({ body }) },
      );
      appendMessage(result.message, result.updatedAt);
      form.reset();
      setSent(true);
    } catch (failure) {
      setSendError(failure);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="team-inbox-thread">
      <button className="team-inline-link team-thread-back" onClick={onBack}>
        <ArrowLeft size={16} />
        {ar ? 'كل المحادثات' : 'All conversations'}
      </button>
      {loading ? (
        <p className="team-loading-copy" role="status">
          {ar ? 'جارٍ فتح المحادثة…' : 'Opening conversation…'}
        </p>
      ) : !thread ? (
        <div className="team-empty-state">
          <p role="alert">{teamError(error, locale)}</p>
        </div>
      ) : (
        <>
          <ThreadHeading thread={thread} locale={locale} />
          {thread.hasMore ? (
            <button
              className="team-older-button"
              onClick={() => void loadOlder()}
              disabled={olderLoading}
            >
              {olderLoading
                ? ar
                  ? 'جارٍ التحميل…'
                  : 'Loading…'
                : ar
                  ? 'عرض الرسائل السابقة'
                  : 'Show earlier messages'}
            </button>
          ) : null}
          <MessageList
            messages={thread.messages}
            locale={locale}
            memberName={profile.displayName}
            staff
          />
          {error ? (
            <p className="team-inline-error" role="status">
              {teamError(error, locale)}
            </p>
          ) : null}
          <form className="team-message-composer" onSubmit={reply}>
            <label className="team-field">
              <span>{ar ? 'ردّك' : 'Your reply'}</span>
              <textarea
                name="body"
                rows={3}
                minLength={1}
                maxLength={3000}
                required
                placeholder={ar ? 'اكتب رداً شخصياً…' : 'Make it personal…'}
              />
            </label>
            {sendError ? (
              <p className="team-form-error" role="alert">
                {teamError(sendError, locale)}
              </p>
            ) : null}
            <div className="team-composer-footer">
              <p role="status">
                {sent ? (
                  <>
                    <Check size={14} />
                    {ar ? 'تم إرسال ردّك' : 'Your reply was sent'}
                  </>
                ) : (
                  <>
                    <LockKeyhole size={13} />
                    {ar
                      ? 'يظهر للزائر في محادثته الخاصة'
                      : 'Visible in the visitor’s private conversation'}
                  </>
                )}
              </p>
              <button className="button button-primary" disabled={pending} type="submit">
                {pending ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : ar ? 'إرسال الرد' : 'Send reply'}
                <Send size={15} />
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
