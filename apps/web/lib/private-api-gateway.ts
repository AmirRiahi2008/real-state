import { NextRequest, NextResponse } from 'next/server';
import { gatewayHeaders } from '@/lib/gateway';
import { teamOrigins, teamRoute } from '@/lib/team-gateway-policy';
import { adminRoute } from '@/lib/admin-gateway-policy';

export function createPrivateGateway(audience: 'team' | 'admin') {
  const membershipPath = audience === 'admin' ? '/admin/session' : '/team/me';
  const opaque = /^[A-Za-z0-9_-]{43}$/;
  const jwt = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  const privateHeaders = {
    'Cache-Control': 'private, no-store, max-age=0',
    Pragma: 'no-cache',
    Vary: 'Cookie',
    'X-Content-Type-Options': 'nosniff',
  };
  const bodyLimit = audience === 'admin' ? 2 * 1024 * 1024 : 16384;
  const photoLimit = (audience === 'admin' ? 10 : 4) * 1024 * 1024 + 65536;
  class GatewayError extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  }
  function json(body: unknown, status = 200) {
    return NextResponse.json(body, { status, headers: privateHeaders });
  }
  function secure(request: NextRequest) {
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    return site ? new URL(site).protocol === 'https:' : request.nextUrl.protocol === 'https:';
  }
  function cookieName(request: NextRequest, key: string) {
    return `${secure(request) ? '__Secure-' : ''}${audience === 'admin' ? 'oriva_admin' : 'oriva'}_${key}`;
  }
  function setCookie(
    response: NextResponse,
    request: NextRequest,
    key: string,
    value: string,
    maxAge: number,
    path = `/api/${audience}`,
  ) {
    response.cookies.set(cookieName(request, key), value, {
      httpOnly: true,
      secure: secure(request),
      sameSite: 'strict',
      path,
      maxAge,
      priority: 'high',
    });
  }
  function clearSession(response: NextResponse, request: NextRequest) {
    for (const key of ['access', 'refresh', 'csrf', 'backend_cookie_secure'])
      setCookie(response, request, key, '', 0);
  }
  function cookie(request: NextRequest, key: string) {
    return request.cookies.get(cookieName(request, key))?.value;
  }
  function assertMutationOrigin(request: NextRequest) {
    if (['GET', 'HEAD'].includes(request.method)) return;
    const origin = request.headers.get('origin');
    if (
      !origin ||
      !teamOrigins(process.env).has(origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site'
    )
      throw new GatewayError(403, 'Origin is not allowed');
  }
  async function readBounded(request: NextRequest, limit: number) {
    const announced = request.headers.get('content-length');
    if (announced && (!/^\d+$/.test(announced) || Number(announced) > limit))
      throw new GatewayError(413, 'Request is too large');
    if (!request.body) return new Uint8Array();
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > limit) {
          await reader.cancel();
          throw new GatewayError(413, 'Request is too large');
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
    return body;
  }
  function backendOrigin() {
    return new URL(
      process.env.AUTH_BACKEND_ORIGIN ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        'http://localhost:3000',
    ).origin;
  }
  async function backend(
    request: NextRequest,
    path: string,
    options: {
      method?: string;
      body?: Uint8Array;
      contentType?: string;
      access?: string;
      refresh?: boolean;
      guest?: string;
      query?: URLSearchParams;
    } = {},
  ) {
    const base = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:4000';
    const prefix = process.env.BACKEND_API_PREFIX || '/api/v1';
    const url = new URL(`${prefix}${path}`, base);
    for (const key of ['page', 'limit', ...(audience === 'admin' ? ['days'] : [])]) {
      const value = options.query?.get(key);
      if (value && /^\d{1,5}$/.test(value)) url.searchParams.set(key, value);
    }
    if (audience === 'admin') {
      for (const key of ['q', 'status', 'role', 'type', 'emirate', 'memberId', 'entityType']) {
        const value = options.query?.get(key);
        if (value && value.length <= 160) url.searchParams.set(key, value);
      }
    }
    const before = options.query?.get('before');
    if (
      before &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(before)
    )
      url.searchParams.set('before', before);
    const headers: Record<string, string> = {
      ...gatewayHeaders(request.headers),
      Accept: 'application/json',
    };
    if (options.contentType) headers['Content-Type'] = options.contentType;
    if (options.access) headers.Authorization = `Bearer ${options.access}`;
    if (options.guest) headers['X-Conversation-Token'] = options.guest;
    if (path.startsWith('/auth/')) headers.Origin = backendOrigin();
    if (options.refresh) {
      const token = cookie(request, 'refresh'),
        csrf = cookie(request, 'csrf');
      if (!token || !csrf || !opaque.test(token) || !opaque.test(csrf))
        throw new GatewayError(401, 'Please sign in again');
      const prefix = cookie(request, 'backend_cookie_secure') === '1' ? '__Host-' : '';
      headers.Cookie = `${prefix}refreshToken=${token}; ${prefix}csrfToken=${csrf}`;
      headers['X-CSRF-Token'] = csrf;
    }
    return fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body as BodyInit | undefined,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  }
  async function parsed(response: Response): Promise<Record<string, unknown>> {
    if (response.status === 204) return {};
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new GatewayError(503, 'The team service is temporarily unavailable');
    return response.json();
  }
  async function presentAuth(request: NextRequest, result: Response) {
    const body = await parsed(result);
    if (!result.ok) {
      const response = json(body, result.status);
      if (result.status === 401) clearSession(response, request);
      return response;
    }
    if (
      typeof body.accessToken !== 'string' ||
      !jwt.test(body.accessToken) ||
      typeof body.csrfToken !== 'string' ||
      !opaque.test(body.csrfToken)
    )
      throw new GatewayError(503, 'Invalid session response');
    const setCookies = result.headers.getSetCookie();
    let refresh: string | undefined;
    let maxAge = 30 * 86400;
    let backendSecure = false;
    for (const header of setCookies) {
      const match = /^((?:__Host-)?refreshToken)=([A-Za-z0-9_-]{43})(?:;|$)/.exec(header);
      if (!match) continue;
      refresh = match[2];
      backendSecure = match[1].startsWith('__Host-');
      const duration = /;\s*Max-Age=(\d+)/i.exec(header);
      if (duration) maxAge = Math.min(30 * 86400, Number(duration[1]));
    }
    if (!refresh) throw new GatewayError(503, 'Invalid session response');
    const accessToken = body.accessToken,
      csrfToken = body.csrfToken,
      refreshToken = refresh;
    // A successful refresh has already rotated the upstream token. Keep its replacement
    // even if the subsequent membership lookup is temporarily unavailable.
    const withSession = (response: NextResponse) => {
      setCookie(
        response,
        request,
        'access',
        accessToken,
        Math.min(900, Number(body.expiresIn) || 900),
      );
      setCookie(response, request, 'refresh', refreshToken, maxAge);
      setCookie(response, request, 'csrf', csrfToken, maxAge);
      setCookie(response, request, 'backend_cookie_secure', backendSecure ? '1' : '0', maxAge);
      return response;
    };
    const unavailable = (status = 503) =>
      withSession(
        json(
          {
            message:
              status === 429
                ? 'Too many requests. Please try again later.'
                : 'The team service is temporarily unavailable',
          },
          status,
        ),
      );
    // Membership is checked on the server; a display title never changes this permission.
    let profileResponse: Response;
    try {
      profileResponse = await backend(request, membershipPath, { access: accessToken });
    } catch {
      return unavailable();
    }
    if (!profileResponse.ok) {
      if (![401, 403, 404].includes(profileResponse.status))
        return unavailable(
          profileResponse.status === 429 || profileResponse.status >= 500
            ? profileResponse.status
            : 503,
        );
      // Revoke a non-member login rather than leaving an orphaned refresh session.
      const csrf = body.csrfToken,
        prefix = backendSecure ? '__Host-' : '';
      const base = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:4000';
      await fetch(new URL(`${process.env.BACKEND_API_PREFIX || '/api/v1'}/auth/logout`, base), {
        method: 'POST',
        headers: {
          Origin: backendOrigin(),
          Cookie: `${prefix}refreshToken=${refresh}; ${prefix}csrfToken=${csrf}`,
          'X-CSRF-Token': csrf,
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined);
      const denied = json({ message: 'This account does not have a team workspace' }, 403);
      clearSession(denied, request);
      return denied;
    }
    let profile: Record<string, unknown>;
    try {
      profile = await parsed(profileResponse);
    } catch {
      return unavailable();
    }
    return withSession(json({ user: body.user, profile }));
  }

  async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    try {
      const { path } = await context.params;
      const resource = path.join('/');
      const route =
        audience === 'admin'
          ? adminRoute(request.method, resource)
          : teamRoute(request.method, resource);
      if (!route) return json({ message: 'Not found' }, 404);
      assertMutationOrigin(request);
      const mutating = !['GET', 'HEAD'].includes(request.method);
      const upload = audience === 'admin' ? resource === 'media' : resource === 'me/photo';
      const contentType = request.headers.get('content-type') || '';
      if (
        mutating &&
        upload &&
        !/^multipart\/form-data;\s*boundary=[\w'()+_,.\/:=? -]{1,160}$/i.test(contentType)
      )
        return json({ message: 'An image upload is required' }, 415);
      if (
        mutating &&
        !upload &&
        request.method !== 'DELETE' &&
        !['auth/logout', 'auth/refresh'].includes(resource) &&
        !/^application\/json(?:\s*;|$)/i.test(contentType)
      )
        return json({ message: 'JSON is required' }, 415);
      const body = mutating
        ? await readBounded(request, upload ? photoLimit : bodyLimit)
        : undefined;
      if (resource === 'auth/login')
        return presentAuth(
          request,
          await backend(request, '/auth/login', {
            method: 'POST',
            body,
            contentType: 'application/json',
          }),
        );
      if (resource === 'auth/refresh')
        return presentAuth(
          request,
          await backend(request, '/auth/refresh', { method: 'POST', refresh: true }),
        );
      if (resource === 'auth/logout') {
        try {
          const result = await backend(request, '/auth/logout', { method: 'POST', refresh: true });
          if (!result.ok) return json(await parsed(result), result.status);
        } catch (error) {
          if (!(error instanceof GatewayError && error.status === 401)) throw error;
        }
        const response = new NextResponse(null, { status: 204, headers: privateHeaders });
        clearSession(response, request);
        return response;
      }
      const access = cookie(request, 'access');
      if (resource === 'session' && audience === 'admin') {
        if (!access || !jwt.test(access)) return json({ message: 'Please sign in' }, 401);
        const result = await backend(request, membershipPath, { access });
        return json(await parsed(result), result.status);
      }
      if (resource === 'session') {
        if (!access || !jwt.test(access)) return json({ message: 'Please sign in' }, 401);
        const [userResult, profileResult] = await Promise.all([
          backend(request, '/auth/me', { access }),
          backend(request, '/team/me', { access }),
        ]);
        if (!userResult.ok || !profileResult.ok) {
          const failed = !userResult.ok ? userResult : profileResult;
          if ([401, 403, 404].includes(failed.status))
            return json({ message: 'Please sign in again' }, failed.status === 401 ? 401 : 403);
          return json(
            { message: 'The team service is temporarily unavailable. Please try again.' },
            failed.status === 429 ? 429 : 503,
          );
        }
        return json({ user: await parsed(userResult), profile: await parsed(profileResult) });
      }
      if (resource === 'auth/change-password') {
        if (!access || !jwt.test(access)) return json({ message: 'Please sign in' }, 401);
        const result = await backend(request, '/auth/change-password', {
          method: 'POST',
          body,
          contentType: 'application/json',
          access,
        });
        if (!result.ok) return json(await parsed(result), result.status);
        const response = new NextResponse(null, { status: 204, headers: privateHeaders });
        clearSession(response, request);
        return response;
      }
      if (route === 'staff' && (!access || !jwt.test(access)))
        return json({ message: 'Please sign in' }, 401);
      if (audience === 'admin' && route === 'staff') {
        const membership = await backend(request, membershipPath, { access });
        if (!membership.ok)
          return json(
            {
              message:
                membership.status === 403 ? 'Administrator access is required' : 'Please try again',
            },
            membership.status,
          );
      }
      let guest: string | undefined;
      if (route === 'guest') {
        guest = cookie(request, `guest_${path[1]}`);
        if (!guest || !opaque.test(guest))
          return json({ message: 'Conversation not found in this browser' }, 404);
      }
      const result = await backend(
        request,
        audience === 'admin' ? `/${resource}` : `/team/${resource}`,
        {
          method: request.method,
          body,
          contentType: mutating ? contentType : undefined,
          access: route === 'staff' ? access : undefined,
          guest,
          query: request.nextUrl.searchParams,
        },
      );
      if (audience === 'admin' && result.ok && /\/file$/.test(resource)) {
        const contentType = result.headers.get('content-type') || '';
        if (!/^image\/(webp|png|jpeg)(?:;|$)/i.test(contentType))
          throw new GatewayError(503, 'Invalid media response');
        return new NextResponse(result.body, {
          status: result.status,
          headers: {
            ...privateHeaders,
            'Content-Type': contentType,
            'Content-Disposition': 'inline',
          },
        });
      }
      if (result.status === 204)
        return new NextResponse(null, { status: 204, headers: privateHeaders });
      const responseBody = await parsed(result);
      const { accessToken, ...safeBody } = responseBody;
      const response = json(safeBody, result.status);
      if (result.ok && resource === 'conversations' && request.method === 'POST') {
        if (
          typeof accessToken !== 'string' ||
          !opaque.test(accessToken) ||
          typeof responseBody.id !== 'string' ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
            responseBody.id,
          )
        )
          throw new GatewayError(503, 'Invalid conversation response');
        setCookie(
          response,
          request,
          `guest_${responseBody.id}`,
          accessToken,
          30 * 86400,
          `/api/team/conversations/${responseBody.id}`,
        );
      }
      return response;
    } catch (error) {
      if (error instanceof GatewayError) return json({ message: error.message }, error.status);
      return json(
        { message: 'The team service is temporarily unavailable. Please try again.' },
        503,
      );
    }
  }
  return handle;
}
