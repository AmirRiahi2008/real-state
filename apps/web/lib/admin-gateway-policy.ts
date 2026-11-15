const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const id = new RegExp(`^${uuid}$`, 'i');
/** Explicit capabilities only; this is never a general authenticated reverse proxy. */
export function adminRoute(method: string, resource: string): 'staff' | 'auth' | null {
  if (method === 'GET' && resource === 'session') return 'auth';
  if (method === 'POST' && /^auth\/(login|refresh|logout|change-password)$/.test(resource))
    return 'auth';
  const parts = resource.split('/');
  const one = parts[2] && id.test(parts[2]);
  if (parts[0] === 'admin') {
    if (
      method === 'GET' &&
      ['session', 'overview', 'options', 'audit', 'site-content', 'team', 'conversations'].includes(
        parts[1],
      ) &&
      parts.length === 2
    )
      return 'staff';
    if (
      method === 'GET' &&
      parts[1] === 'catalog' &&
      ['areas', 'developers', 'amenities', 'agents'].includes(parts[2]) &&
      parts.length === 3
    )
      return 'staff';
    if (parts[1] === 'site-content' && parts.length === 2 && method === 'PATCH') return 'staff';
    if (
      parts[1] === 'team' &&
      ((parts.length === 2 && method === 'POST') ||
        (one && parts.length === 3 && ['GET', 'PATCH'].includes(method)))
    )
      return 'staff';
    if (
      parts[1] === 'conversations' &&
      one &&
      ((parts.length === 3 && method === 'GET') ||
        (parts.length === 4 && parts[3] === 'replies' && method === 'POST'))
    )
      return 'staff';
    if (parts[1] === 'users' && parts.length === 2 && method === 'POST') return 'staff';
    if (
      parts[1] === 'users' &&
      one &&
      parts.length === 4 &&
      parts[3] === 'password' &&
      method === 'POST'
    )
      return 'staff';
  }
  if (['listings', 'projects', 'content'].includes(parts[0]) && parts[1] === 'manage') {
    if (parts.length === 2 && (method === 'POST' || (method === 'GET' && parts[0] !== 'listings')))
      return 'staff';
    if (parts[0] === 'listings' && parts[2] === 'mine' && parts.length === 3 && method === 'GET')
      return 'staff';
    if (one && parts.length === 3 && ['GET', 'PATCH'].includes(method)) return 'staff';
    if (
      one &&
      parts.length === 4 &&
      method === 'POST' &&
      ['submit', 'publish', 'reject', 'archive'].includes(parts[3])
    )
      return 'staff';
  }
  if (['areas', 'developers', 'amenities', 'agents'].includes(parts[0]) && parts[1] === 'manage') {
    if (
      (parts.length === 2 && method === 'POST') ||
      (parts.length === 3 && one && method === 'PATCH')
    )
      return 'staff';
  }
  if (
    parts[0] === 'users' &&
    ((parts.length === 1 && method === 'GET') ||
      (parts.length === 2 && id.test(parts[1]) && method === 'PATCH') ||
      (resource === 'users/me/profile' && method === 'PATCH'))
  )
    return 'staff';
  if (
    parts[0] === 'leads' &&
    ((parts.length === 1 && ['GET', 'POST'].includes(method)) ||
      (parts.length === 2 && id.test(parts[1]) && ['GET', 'PATCH'].includes(method)))
  )
    return 'staff';
  if (resource === 'media' && method === 'POST') return 'staff';
  if (resource === 'media/manage/mine' && method === 'GET') return 'staff';
  if (parts[0] === 'media' && parts.length === 2 && id.test(parts[1]) && method === 'DELETE')
    return 'staff';
  if (
    parts[0] === 'media' &&
    method === 'GET' &&
    ((parts.length === 4 && parts[1] === 'manage' && id.test(parts[2]) && parts[3] === 'file') ||
      (parts.length === 3 && id.test(parts[1]) && parts[2] === 'file'))
  )
    return 'staff';
  return null;
}
