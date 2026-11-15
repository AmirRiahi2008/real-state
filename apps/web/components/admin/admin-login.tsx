'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import type { Locale } from '@/lib/api';
import { AdminApiError, adminError, adminRequest } from './admin-api';
import './admin-shell.css';

export default function AdminLogin({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [visible, setVisible] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setPasswordChanged(new URLSearchParams(window.location.search).get('password') === 'changed');
    void adminRequest<{ user: { role: string } }>('/session', { signal: controller.signal })
      .then((session) => {
        if (session.user.role === 'ADMIN') router.replace(`/${locale}/admin`);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (!(error instanceof AdminApiError && [401, 403].includes(error.status)))
          setFailure(error);
      });
    return () => controller.abort();
  }, [locale, router]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    setPending(true);
    setFailure(null);
    try {
      const session = await adminRequest<{ user: { role: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(values.get('email') || '').trim(),
          password: String(values.get('password') || ''),
        }),
      });
      if (session.user.role !== 'ADMIN')
        throw new AdminApiError(403, 'Administrator access is required.');
      router.replace(`/${locale}/admin`);
      router.refresh();
    } catch (error) {
      setFailure(error);
      setPending(false);
    }
  }

  return (
    <main className="admin-root admin-login-screen" id="main">
      <section
        className="admin-login-story"
        aria-label={ar ? 'أوريفا للإدارة' : 'ORIVA administration'}
      >
        <Link href={`/${locale}`} className="admin-wordmark">
          oriva<span>®</span>
        </Link>
        <div className="admin-login-story-copy">
          <span className="admin-eyebrow">
            <i />
            {ar ? 'مساحة الإدارة' : 'THE MANAGEMENT SPACE'}
          </span>
          <h1>
            {ar ? (
              <>
                رؤية أوضح.
                <br />
                <em>قرارات أفضل.</em>
              </>
            ) : (
              <>
                A clearer view.
                <br />
                <em>A better next move.</em>
              </>
            )}
          </h1>
          <p>
            {ar
              ? 'العقارات، الناس، والمحتوى الذي يجمعهم. كل التفاصيل في مساحة واحدة مدروسة.'
              : 'Properties, people, and the stories that connect them. Every detail, in one considered workspace.'}
          </p>
          <div className="admin-login-visual" aria-hidden="true">
            <div className="admin-login-orbit" />
            <div className="admin-login-buildings">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span className="admin-login-visual-label">ORIVA / CONTROL CENTRE</span>
          </div>
        </div>
        <div className="admin-login-story-footer">
          <span>UNITED ARAB EMIRATES</span>
          <span>BUILT AROUND POSSIBILITY.</span>
        </div>
      </section>
      <section className="admin-login-form-panel">
        <div className="admin-login-links">
          <Link href={`/${locale}`}>
            <ArrowUpRight size={15} />
            {ar ? 'عرض الموقع' : 'View website'}
          </Link>
          <Link href={`/${ar ? 'en' : 'ar'}/admin/login`} lang={ar ? 'en' : 'ar'}>
            {ar ? 'English' : 'العربية'}
          </Link>
        </div>
        <div className="admin-login-form-card">
          <span className="admin-login-lock">
            <LockKeyhole size={25} />
          </span>
          <p className="admin-eyebrow">ORIVA / ADMIN</p>
          <h2>{ar ? 'مرحباً بعودتك.' : 'Welcome back.'}</h2>
          <p className="admin-muted">
            {ar ? 'سجّل الدخول لإدارة عالم أوريفا.' : 'Sign in to manage the world of ORIVA.'}
          </p>
          {passwordChanged ? (
            <div className="admin-alert admin-alert-success" role="status">
              <Check size={17} />
              {ar
                ? 'تم تحديث كلمة المرور. سجّل الدخول بكلمتك الجديدة.'
                : 'Password updated. Sign in with your new password.'}
            </div>
          ) : null}
          <form onSubmit={signIn}>
            <label className="admin-field">
              {ar ? 'البريد الإلكتروني' : 'Email address'}
              <input
                type="email"
                name="email"
                autoComplete="username"
                maxLength={254}
                placeholder="you@example.com"
                required
                dir="ltr"
              />
            </label>
            <div className="admin-field">
              <label htmlFor="admin-login-password">{ar ? 'كلمة المرور' : 'Password'}</label>
              <div className="admin-password-control">
                <input
                  id="admin-login-password"
                  type={visible ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  onClick={() => setVisible((value) => !value)}
                  aria-label={
                    visible
                      ? ar
                        ? 'إخفاء كلمة المرور'
                        : 'Hide password'
                      : ar
                        ? 'إظهار كلمة المرور'
                        : 'Show password'
                  }
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            {failure ? (
              <div className="admin-alert admin-alert-error" role="alert">
                {failure instanceof AdminApiError && failure.status === 401
                  ? ar
                    ? 'البريد الإلكتروني أو كلمة المرور غير صحيح.'
                    : 'That email or password does not match.'
                  : failure instanceof AdminApiError && failure.status === 403
                    ? ar
                      ? 'هذا الحساب لا يملك صلاحية الإدارة.'
                      : 'This account does not have administrator access.'
                    : adminError(failure, locale)}
              </div>
            ) : null}
            <button
              type="submit"
              className="admin-button admin-button-primary admin-full-width"
              disabled={pending}
            >
              {pending
                ? ar
                  ? 'جارٍ تسجيل الدخول…'
                  : 'Signing in…'
                : ar
                  ? 'تسجيل الدخول'
                  : 'Sign in'}
              <ArrowUpRight size={17} />
            </button>
          </form>
          <p className="admin-login-private">
            <ShieldCheck size={16} />
            {ar
              ? 'وصول مخصص لحسابات الإدارة المعتمدة.'
              : 'Private access for authorised administrators.'}
          </p>
        </div>
        <p className="admin-login-bottom">
          <Building2 size={15} />
          ORIVA — {ar ? 'منظور جديد للحياة.' : 'A new perspective on living.'}
        </p>
      </section>
    </main>
  );
}
