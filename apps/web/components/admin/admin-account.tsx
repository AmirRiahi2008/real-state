'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowUpRight, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import type { Locale } from '@/lib/api';
import { AdminApiError, adminError, adminRequest } from './admin-api';

export interface AdminAccountUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function AdminAccount({ user, locale }: { user: AdminAccountUser; locale: Locale }) {
  const ar = locale === 'ar';
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [validation, setValidation] = useState('');
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword') || '');
    if (newPassword !== String(form.get('confirmPassword') || '')) {
      setValidation(ar ? 'كلمتا المرور غير متطابقتين.' : 'The new passwords do not match.');
      return;
    }
    setValidation('');
    setFailure(null);
    setPending(true);
    try {
      await adminRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: String(form.get('currentPassword') || ''),
          newPassword,
        }),
      });
      router.replace(`/${locale}/admin/login?password=changed`);
      router.refresh();
    } catch (error) {
      setFailure(error);
      setPending(false);
    }
  }
  return (
    <div className="admin-account-layout">
      <section className="admin-card admin-account-profile">
        <span className="admin-feature-icon">
          <UserRound size={22} />
        </span>
        <p className="admin-eyebrow">{ar ? 'حسابك' : 'YOUR ACCOUNT'}</p>
        <h2 className="admin-section-title">
          {user.firstName} {user.lastName}
        </h2>
        <p className="admin-muted" dir="ltr">
          {user.email}
        </p>
        <span className="admin-badge admin-badge-green">
          <ShieldCheck size={13} />
          {ar ? 'مدير النظام' : 'Administrator'}
        </span>
        <p className="admin-muted">
          {ar
            ? 'تتيح صلاحية الإدارة إدارة المحتوى والعقارات والمشاريع والفريق. تُسجّل التغييرات في سجل النشاط.'
            : 'Administrator access includes content, properties, projects and the team. Changes are recorded in the activity log.'}
        </p>
        <Link className="admin-button" href={`/${locale}/dashboard`}>
          {ar ? 'مساحة الفريق الشخصية' : 'Personal team workspace'}
          <ArrowUpRight size={15} />
        </Link>
      </section>
      <section className="admin-card">
        <div className="admin-card-heading">
          <span className="admin-feature-icon">
            <KeyRound size={22} />
          </span>
          <div>
            <h2 className="admin-section-title">{ar ? 'تغيير كلمة المرور' : 'Change password'}</h2>
            <p className="admin-muted">
              {ar
                ? 'سيتم إنهاء الجلسات الحالية بعد تحديث كلمة المرور.'
                : 'Updating your password signs out existing sessions.'}
            </p>
          </div>
        </div>
        <form className="admin-password-form" onSubmit={changePassword}>
          <label className="admin-field">
            {ar ? 'كلمة المرور الحالية' : 'Current password'}
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <div className="admin-grid">
            <label className="admin-field">
              {ar ? 'كلمة المرور الجديدة' : 'New password'}
              <input
                type="password"
                name="newPassword"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <label className="admin-field">
              {ar ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
          </div>
          <p className="admin-muted admin-small">
            {ar
              ? 'استخدم ١٢ حرفاً على الأقل لكلمة المرور الجديدة.'
              : 'Use at least 12 characters for your new password.'}
          </p>
          {validation || failure ? (
            <div className="admin-alert admin-alert-error" role="alert">
              {validation ||
                (failure instanceof AdminApiError && failure.status === 401
                  ? ar
                    ? 'تعذّر التحقق من كلمة المرور الحالية. راجعها أو سجّل الدخول مجدداً إذا انتهت الجلسة.'
                    : 'Your current password could not be verified. Check it, or sign in again if your session has ended.'
                  : adminError(failure, locale))}
            </div>
          ) : null}
          <button type="submit" className="admin-button admin-button-primary" disabled={pending}>
            {pending
              ? ar
                ? 'جارٍ التحديث…'
                : 'Updating…'
              : ar
                ? 'تحديث كلمة المرور'
                : 'Update password'}
            <ArrowUpRight size={16} />
          </button>
        </form>
      </section>
    </div>
  );
}
