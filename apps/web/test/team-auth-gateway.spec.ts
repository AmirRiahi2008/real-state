import { expect, test } from '@playwright/test';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { NextRequest, type NextResponse } from 'next/server';

const origin = 'http://localhost:3000';
const accessToken = 'e30.eyJzdWIiOiJzeW50aGV0aWMifQ.test_signature';
const refreshToken = 'R'.repeat(43);
const csrfToken = 'C'.repeat(43);
const oldRefreshToken = 'r'.repeat(43);
const oldCsrfToken = 'c'.repeat(43);
const environment = {
  NEXT_PUBLIC_SITE_URL: origin,
  AUTH_BACKEND_ORIGIN: origin,
  BACKEND_INTERNAL_URL: 'http://team-api.invalid',
  BACKEND_API_PREFIX: '/api/v1',
  WEB_GATEWAY_SECRET: '',
};
const previousEnvironment = new Map<string, string | undefined>();
const originalFetch = globalThis.fetch;
let post: typeof import('../app/api/team/[...path]/route').POST;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // Next resolves this build-time marker to its empty server entry. Reproduce only
  // that resolution so the actual route can run in Node without a Next server.
  const marker = pathToFileURL(require.resolve('next/dist/compiled/server-only/empty.js')).href;
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      return specifier === 'server-only'
        ? { url: marker, shortCircuit: true }
        : nextResolve(specifier, context);
    },
  });
  try {
    post = (await import('../app/api/team/[...path]/route')).POST;
  } finally {
    hooks.deregister();
  }
});

test.beforeEach(() => {
  for (const [key, value] of Object.entries(environment)) {
    previousEnvironment.set(key, process.env[key]);
    process.env[key] = value;
  }
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of previousEnvironment) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  previousEnvironment.clear();
});

function authenticatedResponse() {
  return Response.json(
    {
      accessToken,
      csrfToken,
      expiresIn: 900,
      user: { id: 'synthetic-user', email: 'member@example.test', role: 'TEAM_MEMBER' },
    },
    {
      headers: {
        'Set-Cookie': `refreshToken=${refreshToken}; Path=/api/v1/auth; Max-Age=2592000; HttpOnly; SameSite=Strict`,
      },
    },
  );
}

function authRequest(action: 'login' | 'refresh') {
  return new NextRequest(`${origin}/api/team/auth/${action}`, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      Cookie: `oriva_refresh=${oldRefreshToken}; oriva_csrf=${oldCsrfToken}; oriva_backend_cookie_secure=0`,
    },
    ...(action === 'login'
      ? { body: JSON.stringify({ email: 'member@example.test', password: 'SYNTHETIC_TEST_VALUE' }) }
      : {}),
  });
}

async function assertPrivateError(response: NextResponse) {
  const body = await response.text();
  expect(JSON.parse(body)).not.toHaveProperty('accessToken');
  expect(JSON.parse(body)).not.toHaveProperty('csrfToken');
  expect(JSON.parse(body)).not.toHaveProperty('user');
  for (const value of [accessToken, refreshToken, csrfToken, oldRefreshToken, oldCsrfToken])
    expect(body).not.toContain(value);
  expect(response.headers.get('cache-control')).toContain('no-store');
  for (const header of response.headers.getSetCookie()) {
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=strict');
    expect(header).toContain('Path=/api/team');
  }
}

for (const action of ['login', 'refresh'] as const) {
  for (const failure of [503, 429, 'throw'] as const) {
    test(`${action} preserves the fresh session when the membership probe returns ${failure}`, async () => {
      const calls: string[] = [];
      globalThis.fetch = async (input, init) => {
        const path = new URL(String(input)).pathname;
        calls.push(path);
        if (path === `/api/v1/auth/${action}`) {
          if (action === 'refresh') {
            const headers = new Headers(init?.headers);
            expect(headers.get('cookie')).toContain(`refreshToken=${oldRefreshToken}`);
            expect(headers.get('x-csrf-token')).toBe(oldCsrfToken);
          }
          return authenticatedResponse();
        }
        if (path === '/api/v1/team/me') {
          expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${accessToken}`);
          if (failure === 'throw') throw new TypeError('Synthetic upstream connection failure');
          return Response.json({ message: 'Synthetic membership failure' }, { status: failure });
        }
        throw new Error(`Unexpected upstream path: ${path}`);
      };

      const response = await post(authRequest(action), {
        params: Promise.resolve({ path: ['auth', action] }),
      });
      expect(response.status).toBe(failure === 'throw' ? 503 : failure);
      expect(calls).toEqual([`/api/v1/auth/${action}`, '/api/v1/team/me']);
      for (const [key, value] of Object.entries({
        access: accessToken,
        refresh: refreshToken,
        csrf: csrfToken,
        backend_cookie_secure: '0',
      })) {
        expect(response.cookies.get(`oriva_${key}`)).toMatchObject({
          value,
          httpOnly: true,
          sameSite: 'strict',
          path: '/api/team',
        });
        expect(response.cookies.get(`oriva_${key}`)?.maxAge).toBeGreaterThan(0);
      }
      await assertPrivateError(response);
    });
  }

  test(`${action} revokes and clears a session when membership is definitively denied`, async () => {
    const calls: string[] = [];
    globalThis.fetch = async (input, init) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === `/api/v1/auth/${action}`) return authenticatedResponse();
      if (path === '/api/v1/team/me')
        return Response.json({ message: 'Insufficient permissions' }, { status: 403 });
      if (path === '/api/v1/auth/logout') {
        const headers = new Headers(init?.headers);
        expect(headers.get('cookie')).toContain(`refreshToken=${refreshToken}`);
        expect(headers.get('x-csrf-token')).toBe(csrfToken);
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected upstream path: ${path}`);
    };

    const response = await post(authRequest(action), {
      params: Promise.resolve({ path: ['auth', action] }),
    });
    expect(response.status).toBe(403);
    expect(calls).toEqual([`/api/v1/auth/${action}`, '/api/v1/team/me', '/api/v1/auth/logout']);
    for (const key of ['access', 'refresh', 'csrf', 'backend_cookie_secure'])
      expect(response.cookies.get(`oriva_${key}`)).toMatchObject({ value: '', maxAge: 0 });
    await assertPrivateError(response);
  });
}
