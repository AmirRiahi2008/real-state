import { NextRequest } from 'next/server';
import { gatewayHeaders } from '@/lib/gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Public website gateway: only these routes are exposed; staff mutations stay outside this surface.
const publicGet =
  /^v1\/(?:listings(?:\/[a-z0-9-]+(?:\/related)?)?|projects(?:\/[a-z0-9-]+)?|areas(?:\/[a-z0-9-]+)?|developers(?:\/[a-z0-9-]+)?|amenities|agents(?:\/[a-z0-9-]+)?|catalog\/autocomplete|content(?:\/[a-z0-9-]+)?|calculators\/(?:mortgage|rental-yield)|media\/[a-f0-9-]{36}\/file|health\/ready)$/;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const resource = path.join('/');
  const allowed =
    request.method === 'GET'
      ? publicGet.test(resource)
      : request.method === 'POST' && resource === 'v1/leads';
  if (!allowed || resource.split('/').includes('manage'))
    return Response.json({ message: 'Not found' }, { status: 404 });
  const destination = new URL(
    `/api/${resource}`,
    process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:4000',
  );
  destination.search = request.nextUrl.search;
  if (request.method === 'POST') {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin)
      return Response.json({ message: 'Origin is not allowed' }, { status: 403 });
    if (!request.headers.get('content-type')?.includes('application/json'))
      return Response.json({ message: 'JSON is required' }, { status: 415 });
    if (Number(request.headers.get('content-length') || 0) > 32768)
      return Response.json({ message: 'Request is too large' }, { status: 413 });
  }
  const body = request.method === 'POST' ? await request.text() : undefined;
  if (body && Buffer.byteLength(body) > 32768)
    return Response.json({ message: 'Request is too large' }, { status: 413 });
  try {
    // Do not forward untrusted Host, Authorization, cookies, Origin, or arbitrary forwarding headers.
    const result = await fetch(destination, {
      method: request.method,
      headers: {
        ...gatewayHeaders(request.headers),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(destination.hostname.endsWith('.onrender.com') ? 90000 : 12000),
    });
    if (
      (!resource.endsWith('/file') &&
        !result.headers.get('content-type')?.includes('application/json')) ||
      (request.method === 'POST' && result.ok && result.status !== 202)
    )
      return Response.json(
        { message: 'The property service is waking up. Please try again shortly.' },
        { status: 503 },
      );
    const headers = new Headers({
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    for (const key of [
      'content-type',
      'content-length',
      'content-disposition',
      'x-request-id',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'retry-after',
    ]) {
      const value = result.headers.get(key);
      if (value) headers.set(key, value);
    }
    return new Response(result.body, { status: result.status, headers });
  } catch {
    return Response.json(
      { message: 'The property service is temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
