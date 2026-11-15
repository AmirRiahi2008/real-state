import { expect, test } from '@playwright/test';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { NextRequest, type NextResponse } from 'next/server';
import { adminRoute } from '../lib/admin-gateway-policy';

const origin = 'http://localhost:3000';
const id = '00000000-0000-4000-8000-000000000001';
const access = 'e30.eyJzdWIiOiJzeW50aGV0aWMifQ.admin_signature';
const refresh = 'R'.repeat(43),
  csrf = 'C'.repeat(43),
  oldRefresh = 'r'.repeat(43),
  oldCsrf = 'c'.repeat(43);
const user = {
  id,
  email: 'administrator@example.test',
  firstName: 'Synthetic',
  lastName: 'Administrator',
  role: 'ADMIN',
};
const environment = {
  NEXT_PUBLIC_SITE_URL: origin,
  AUTH_BACKEND_ORIGIN: origin,
  BACKEND_INTERNAL_URL: 'http://admin-api.invalid',
  BACKEND_API_PREFIX: '/api/v1',
  WEB_GATEWAY_SECRET: '',
};
const previous = new Map<string, string | undefined>();
const originalFetch = globalThis.fetch;
let handler: typeof import('../app/api/admin/[...path]/route').POST;

test.describe.configure({ mode: 'serial' });
test.beforeAll(async () => {
  // Reproduce Next's server-only marker resolution, while exercising its actual gateway.
  const marker = pathToFileURL(require.resolve('next/dist/compiled/server-only/empty.js')).href;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      return specifier === 'server-only'
        ? { url: marker, shortCircuit: true }
        : nextResolve(specifier, context);
    },
  });
  try {
    handler = (await import('../app/api/admin/[...path]/route')).POST;
  } finally {
    hooks.deregister();
  }
});
test.beforeEach(() => {
  for (const [key, value] of Object.entries(environment)) {
    previous.set(key, process.env[key]);
    process.env[key] = value;
  }
});
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previous.clear();
});

const cookies = `oriva_admin_access=${access}; oriva_admin_refresh=${oldRefresh}; oriva_admin_csrf=${oldCsrf}; oriva_admin_backend_cookie_secure=0`;
function incoming(
  method: string,
  resource: string,
  options: {
    headers?: Record<string, string>;
    cookie?: string;
    body?: unknown;
    requestOrigin?: string;
  } = {},
) {
  return new NextRequest(`${options.requestOrigin ?? origin}/api/admin/${resource}`, {
    method,
    headers: {
      ...(method !== 'GET'
        ? { Origin: options.requestOrigin ?? origin, 'Content-Type': 'application/json' }
        : {}),
      Cookie: options.cookie ?? cookies,
      ...options.headers,
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}
function send(method: string, resource: string, options: Parameters<typeof incoming>[2] = {}) {
  return handler(incoming(method, resource, options), {
    params: Promise.resolve({ path: resource.split('/') }),
  });
}
function authenticated(role = 'ADMIN', secure = false) {
  return Response.json(
    { accessToken: access, csrfToken: csrf, expiresIn: 900, user: { ...user, role } },
    {
      headers: {
        'Set-Cookie': `${secure ? '__Host-' : ''}refreshToken=${refresh}; Path=/api/v1/auth; Max-Age=2592000; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`,
      },
    },
  );
}
async function privateJson(response: NextResponse) {
  const raw = await response.text();
  for (const secret of [access, refresh, csrf, oldRefresh, oldCsrf])
    expect(raw).not.toContain(secret);
  const body = JSON.parse(raw);
  expect(body).not.toHaveProperty('accessToken');
  expect(body).not.toHaveProperty('csrfToken');
  expect(response.headers.get('cache-control')).toContain('no-store');
  return body;
}
function freshCookies(response: NextResponse, secure = false) {
  const prefix = secure ? '__Secure-' : '';
  expect(response.cookies.getAll()).toHaveLength(4);
  for (const [key, value] of Object.entries({
    access,
    refresh,
    csrf,
    backend_cookie_secure: secure ? '1' : '0',
  })) {
    expect(response.cookies.get(`${prefix}oriva_admin_${key}`)).toMatchObject({
      value,
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/admin',
      secure,
    });
    expect(response.cookies.get(`${prefix}oriva_admin_${key}`)?.maxAge).toBeGreaterThan(0);
  }
  expect(response.cookies.get('oriva_access')).toBeUndefined();
}

test('the administrator policy has explicit capabilities and rejects arbitrary auth, file and proxy paths', () => {
  for (const [method, path] of [
    ['GET', 'admin/overview'],
    ['GET', 'listings/manage/mine'],
    ['POST', 'admin/site-content'],
    ['GET', `media/manage/${id}/file`],
    ['DELETE', `media/${id}`],
  ])
    expect(adminRoute(method, path)).toBe(path === 'admin/site-content' ? null : 'staff');
  for (const path of [
    'auth/me',
    'auth/register',
    'auth/password-reset/request',
    '../auth/login',
    'https://evil.invalid/private',
    'media/manage/../../auth/me',
    `media/manage/${id}/file/secret`,
    'admin/database',
    'users/export-secrets',
  ])
    expect(adminRoute('GET', path)).toBeNull();
  expect(adminRoute('DELETE', `users/${id}`)).toBeNull();
  expect(adminRoute('PATCH', 'admin/site-content')).toBe('staff');
});

test('an administrator login sets isolated HttpOnly cookies without exposing tokens to JavaScript', async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    if (path === '/api/v1/auth/login') return authenticated();
    if (path === '/api/v1/admin/session') {
      expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${access}`);
      return Response.json({ user });
    }
    throw new Error('Unexpected upstream request');
  };
  const response = await send('POST', 'auth/login', {
    body: { email: user.email, password: 'SYNTHETIC_TEST_VALUE' },
  });
  expect(response.status).toBe(200);
  freshCookies(response);
  expect((await privateJson(response)).user.role).toBe('ADMIN');
  expect(calls).toEqual(['/api/v1/auth/login', '/api/v1/admin/session']);
});

test('a team-member login is denied, its newly issued refresh is revoked and admin cookies are cleared', async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    if (path === '/api/v1/auth/login') return authenticated('TEAM_MEMBER');
    if (path === '/api/v1/admin/session')
      return Response.json({ message: 'Administrator required' }, { status: 403 });
    if (path === '/api/v1/auth/logout') {
      expect(new Headers(init?.headers).get('cookie')).toContain(`refreshToken=${refresh}`);
      expect(new Headers(init?.headers).get('x-csrf-token')).toBe(csrf);
      return new Response(null, { status: 204 });
    }
    throw new Error('Unexpected upstream request');
  };
  const response = await send('POST', 'auth/login', {
    body: { email: 'member@example.test', password: 'SYNTHETIC_TEST_VALUE' },
  });
  expect(response.status).toBe(403);
  for (const key of ['access', 'refresh', 'csrf', 'backend_cookie_secure'])
    expect(response.cookies.get(`oriva_admin_${key}`)).toMatchObject({
      value: '',
      path: '/api/admin',
      maxAge: 0,
    });
  expect(calls).toEqual(['/api/v1/auth/login', '/api/v1/admin/session', '/api/v1/auth/logout']);
  await privateJson(response);
});

test('a demoted account is rejected before an AGENT-compatible listing endpoint is called', async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    if (path === '/api/v1/admin/session')
      return Response.json({ message: 'Account is now AGENT' }, { status: 403 });
    throw new Error('Protected data must never be requested');
  };
  const response = await send('GET', 'listings/manage/mine');
  expect(response.status).toBe(403);
  expect(calls).toEqual(['/api/v1/admin/session']);
  await privateJson(response);
});

test('team cookies and an incoming bearer header cannot authenticate the administrator gateway', async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    throw new Error('No upstream request expected');
  };
  const response = await send('GET', 'admin/overview', {
    cookie: `oriva_access=${access}; oriva_refresh=${oldRefresh}; oriva_csrf=${oldCsrf}`,
    headers: { Authorization: `Bearer ${access}` },
  });
  expect(response.status).toBe(401);
  expect(calls).toEqual([]);
  await privateJson(response);
});

test('all mutations enforce an exact same-site Origin before touching the backend', async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    throw new Error('No upstream request expected');
  };
  const attempts: Record<string, string>[] = [
    { Origin: '' },
    { Origin: 'https://evil.invalid' },
    { Origin: 'http://localhost:3000.evil.invalid' },
    { Origin: origin, 'Sec-Fetch-Site': 'cross-site' },
  ];
  for (const headers of attempts) {
    const response = await send('PATCH', 'admin/site-content', {
      headers,
      body: { expectedVersion: 1, values: {} },
    });
    expect(response.status).toBe(403);
  }
  expect(calls).toEqual([]);
});

test('unlisted paths and malformed resource IDs never become an authenticated reverse proxy', async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    throw new Error('No upstream request expected');
  };
  for (const resource of [
    'auth/me',
    'auth/register',
    'admin/secrets',
    'https://evil.invalid/private',
    'media/manage/not-a-uuid/file',
    `media/manage/${id}/file/extra`,
  ])
    expect((await send('GET', resource)).status).toBe(404);
  expect(calls).toEqual([]);
});

test('JSON mutation limits and image-only upload types are enforced before upstream access', async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    throw new Error('No upstream request expected');
  };
  expect(
    (
      await send('PATCH', 'admin/site-content', {
        headers: { 'Content-Length': String(2 * 1024 * 1024 + 1) },
        body: {},
      })
    ).status,
  ).toBe(413);
  expect(
    (
      await send('PATCH', 'admin/site-content', {
        headers: { 'Content-Type': 'text/plain' },
        body: {},
      })
    ).status,
  ).toBe(415);
  expect((await send('POST', 'media', { body: {} })).status).toBe(415);
  expect(calls).toEqual([]);
});

for (const failure of [429, 503, 'throw'] as const) {
  test(`a rotated admin refresh is preserved if membership lookup returns ${failure}`, async () => {
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === '/api/v1/auth/refresh') {
        const headers = new Headers(init?.headers);
        expect(headers.get('cookie')).toContain(`refreshToken=${oldRefresh}`);
        expect(headers.get('x-csrf-token')).toBe(oldCsrf);
        return authenticated();
      }
      if (path === '/api/v1/admin/session') {
        if (failure === 'throw') throw new TypeError('Synthetic connection error');
        return Response.json({ message: 'Temporary failure' }, { status: failure });
      }
      throw new Error('No logout expected');
    };
    const response = await send('POST', 'auth/refresh');
    expect(response.status).toBe(failure === 'throw' ? 503 : failure);
    freshCookies(response);
    await privateJson(response);
    expect(calls).toEqual(['/api/v1/auth/refresh', '/api/v1/admin/session']);
  });
}

test('HTTPS admin sessions use Secure-prefixed cookies and the secure upstream refresh names', async () => {
  const https = 'https://admin.example.test';
  process.env.NEXT_PUBLIC_SITE_URL = https;
  process.env.AUTH_BACKEND_ORIGIN = https;
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === '/api/v1/auth/refresh') {
      expect(new Headers(init?.headers).get('cookie')).toContain(
        `__Host-refreshToken=${oldRefresh}`,
      );
      return authenticated('ADMIN', true);
    }
    if (path === '/api/v1/admin/session') return Response.json({ user });
    throw new Error('Unexpected upstream request');
  };
  const response = await send('POST', 'auth/refresh', {
    requestOrigin: https,
    cookie: `__Secure-oriva_admin_refresh=${oldRefresh}; __Secure-oriva_admin_csrf=${oldCsrf}; __Secure-oriva_admin_backend_cookie_secure=1`,
  });
  expect(response.status).toBe(200);
  freshCookies(response, true);
  await privateJson(response);
});

test('private media responses stay image-only and retain no-store headers', async () => {
  let type = 'text/html';
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    if (path === '/api/v1/admin/session') return Response.json({ user });
    if (path === `/api/v1/media/manage/${id}/file`)
      return new Response(type === 'text/html' ? '<script>bad</script>' : 'synthetic-image', {
        headers: { 'Content-Type': type },
      });
    throw new Error('Unexpected upstream request');
  };
  const denied = await send('GET', `media/manage/${id}/file`);
  expect(denied.status).toBe(503);
  type = 'image/webp';
  const allowed = await send('GET', `media/manage/${id}/file`);
  expect(allowed.status).toBe(200);
  expect(allowed.headers.get('content-type')).toBe(type);
  expect(allowed.headers.get('cache-control')).toContain('no-store');
  expect(allowed.headers.get('x-content-type-options')).toBe('nosniff');
  expect(await allowed.text()).toBe('synthetic-image');
  expect(calls.filter((path) => path === '/api/v1/admin/session')).toHaveLength(2);
});
