'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import Reveal from '@/components/reveal';
import type { Locale } from '@/lib/api';
import type { TeamSession } from '@/lib/team-types';
import { isAbort, teamError, teamRequest, TeamApiError } from './team-api';
import './team.css';

export default function TeamLogin({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void teamRequest<TeamSession>('/session', { signal: controller.signal })
      .then(() => router.replace(`/${locale}/dashboard`))
      .catch((failure) => {
        if (!isAbort(failure) && !(failure instanceof TeamApiError && failure.status === 401))
          setError(failure);
      });
    return () => controller.abort();
  }, [locale, router]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await teamRequest<TeamSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: String(values.get('email') || '').trim(),
          password: String(values.get('password') || ''),
        }),
      });
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    } catch (failure) {
      setError(failure);
      setPending(false);
    }
  }
  return (
    <div className="team-page team-login-page">
      <div className="container team-login-layout">
        <Reveal className="team-login-story">
          <Link className="team-inline-link" href={`/${locale}/qa`}>
            <ArrowLeft size={16} />
            {ar ? 'العودة إلى QA' : 'Back to QA'}
          </Link>
          <p className="eyebrow">
            <span className="status-dot" />
            {ar ? 'مساحة الفريق' : 'THE TEAM SPACE'}
          </p>
          <h1>
            {ar ? (
              <>
                مكانك.
                <br />
                <em>محادثاتك.</em>
              </>
            ) : (
              <>
                Your space.
                <br />
                <em>Your conversations.</em>
              </>
            )}
          </h1>
          <p>
            {ar
              ? 'صندوق رسائلك، ملفك الشخصي، والتفاصيل التي تجعل حضورك أقرب للناس.'
              : 'Your inbox, your profile, and the small details that make a personal connection.'}
          </p>
          <div className="team-login-art" aria-hidden="true">
            <span />
            <span />
            <span />
            <LockKeyhole size={50} />
          </div>
        </Reveal>
        <Reveal className="team-login-card" delay={0.1}>
          <span className="team-card-icon">
            <LockKeyhole size={23} />
          </span>
          <p className="team-section-label">ORIVA / TEAM</p>
          <h2>{ar ? 'مرحباً بعودتك.' : 'Welcome back.'}</h2>
          <p>{ar ? 'سجّل الدخول إلى مساحتك الشخصية.' : 'Sign in to your personal workspace.'}</p>
          <form onSubmit={login}>
            <label className="team-field">
              {ar ? 'البريد الإلكتروني' : 'Email address'}
              <input
                name="email"
                type="email"
                dir="ltr"
                autoComplete="username"
                maxLength={254}
                required
                placeholder="you@example.com"
              />
            </label>
            <label className="team-field">
              {ar ? 'كلمة المرور' : 'Password'}
              <span className="team-password-input">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  maxLength={128}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={
                    showPassword
                      ? ar
                        ? 'إخفاء كلمة المرور'
                        : 'Hide password'
                      : ar
                        ? 'إظهار كلمة المرور'
                        : 'Show password'
                  }
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {error ? (
              <p className="team-form-error" role="alert">
                {error instanceof TeamApiError && error.status === 401
                  ? ar
                    ? 'البريد الإلكتروني أو كلمة المرور غير صحيح.'
                    : 'That email or password does not match.'
                  : teamError(error, locale)}
              </p>
            ) : null}
            <button
              className="button button-primary team-full-button"
              type="submit"
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
          <p className="team-private-copy">
            <LockKeyhole size={13} />
            {ar
              ? 'وصول شخصي إلى ملفك ورسائلك فقط.'
              : 'Personal access to your profile and conversations.'}
          </p>
        </Reveal>
      </div>
    </div>
  );
}
