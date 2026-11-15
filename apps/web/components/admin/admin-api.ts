'use client';

import type { Locale } from '@/lib/api';

export const adminSessionExpired = 'oriva-admin-session-expired';

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

type SessionRecovery = 'renewed' | 'already-valid' | 'unavailable';
let recovery: Promise<SessionRecovery> | null = null;

function staffRequest(path: string) {
  return !/^\/auth\/(login|logout|refresh)$/.test(path.split('?')[0]);
}

function rawRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  return fetch(`/api/admin${path}`, {
    ...init,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
}

/** One rotation at a time, including across tabs sharing the same HttpOnly cookies. */
function recoverSession(): Promise<SessionRecovery> {
  if (recovery) return recovery;
  if (typeof navigator === 'undefined' || !navigator.locks) return Promise.resolve('unavailable');
  const pending = navigator.locks.request(
    'oriva-admin-refresh',
    async (): Promise<SessionRecovery> => {
      try {
        // A preceding tab may already have replaced the shared session cookies.
        const session = await rawRequest('/session');
        if (session.ok) return 'already-valid';
        if (session.status !== 401) return 'unavailable';
        const refreshed = await rawRequest('/auth/refresh', { method: 'POST' });
        return refreshed.ok ? 'renewed' : 'unavailable';
      } catch {
        return 'unavailable';
      }
    },
  );
  recovery = pending;
  const clear = () => {
    if (recovery === pending) recovery = null;
  };
  void pending.then(clear, clear);
  return pending;
}

export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await rawRequest(path, init);
  if (response.status === 401 && staffRequest(path)) {
    const result = await recoverSession();
    // A wrong current password also returns 401, but must not rotate a valid session.
    const passwordChange = path.split('?')[0] === '/auth/change-password';
    const retry = result === 'renewed' || (result === 'already-valid' && !passwordChange);
    if (init.signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');
    if (retry) response = await rawRequest(path, init);
  }
  if (
    response.status === 401 &&
    staffRequest(path) &&
    path.split('?')[0] !== '/auth/change-password'
  ) {
    window.dispatchEvent(new Event(adminSessionExpired));
  }
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;
    throw new AdminApiError(response.status, message || 'The request could not be completed.');
  }
  if (body === null && response.status !== 204)
    throw new AdminApiError(503, 'The service is temporarily unavailable.');
  return body as T;
}

export function adminError(error: unknown, locale: Locale) {
  const ar = locale === 'ar';
  if (error instanceof AdminApiError) {
    if (error.status === 401)
      return ar
        ? 'انتهت الجلسة. يرجى تسجيل الدخول مجدداً.'
        : 'Your session has ended. Please sign in again.';
    if (error.status === 403)
      return ar
        ? 'هذا الإجراء غير متاح لهذا الحساب.'
        : 'This action is not available for this account.';
    if (error.status === 429)
      return ar
        ? 'طلبات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مجدداً.'
        : 'A few too many requests. Please wait a moment and try again.';
    if (error.status === 413)
      return ar
        ? 'حجم الصورة كبير. اختر صورة أصغر من ٥ ميغابايت.'
        : 'That image is too large. Choose a photo under 5 MB.';
    if (error.status >= 500)
      return ar
        ? 'الخدمة غير متاحة مؤقتاً. حاول بعد قليل.'
        : 'The service is temporarily unavailable. Please try again shortly.';
    if (!ar) return error.message;
    return 'تعذّر إكمال الطلب. راجع البيانات وحاول مجدداً.';
  }
  return ar
    ? 'تعذّر الاتصال. تحقق من اتصالك وحاول مجدداً.'
    : 'We could not connect. Please try again.';
}

export function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}
