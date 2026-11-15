const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const conversation = new RegExp(`^conversations/(${uuid})(/messages)?$`, 'i');
const inbox = new RegExp(`^inbox(?:/(${uuid})(/replies)?)?$`, 'i');

export function teamRoute(
  method: string,
  resource: string,
): 'public' | 'guest' | 'staff' | 'auth' | null {
  if (method === 'GET' && /^members(?:\/[a-z0-9-]{1,120})?$/.test(resource)) return 'public';
  if (method === 'POST' && resource === 'conversations') return 'public';
  const thread = conversation.exec(resource);
  if (thread && ((method === 'GET' && !thread[2]) || (method === 'POST' && thread[2])))
    return 'guest';
  if (method === 'GET' && resource === 'session') return 'auth';
  if (method === 'POST' && /^auth\/(login|refresh|logout|change-password)$/.test(resource))
    return 'auth';
  if (
    (resource === 'me' && ['GET', 'PATCH'].includes(method)) ||
    (resource === 'me/photo' && method === 'POST')
  )
    return 'staff';
  const mail = inbox.exec(resource);
  if (mail && ((method === 'GET' && !mail[2]) || (method === 'POST' && mail[1] && mail[2])))
    return 'staff';
  return null;
}

export function teamOrigins(env: Record<string, string | undefined>): Set<string> {
  const configured = [
    env.NEXT_PUBLIC_SITE_URL,
    env.RENDER_EXTERNAL_URL,
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined,
    env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
  ].filter(Boolean) as string[];
  const origins = new Set(configured.map((value) => new URL(value).origin));
  if (!configured.length) {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }
  return origins;
}
