import 'server-only';
import { headers } from 'next/headers';
import { gatewayHeaders } from './gateway';
import { ApiError, type Paginated, type Listing, type Project, type Area } from './api';

function queryString(query?: Record<string, string>): string {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== '') params.set(key, value);
  });
  return params.size ? `?${params}` : '';
}
async function serverApi<T>(path: string): Promise<T> {
  const base = process.env.BACKEND_INTERNAL_URL || 'http://127.0.0.1:4000';
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, '')}/api/v1${path}`, {
      cache: 'no-store',
      headers: gatewayHeaders(await headers()),
      signal: AbortSignal.timeout(base.includes('.onrender.com') ? 90000 : 12000),
    });
  } catch {
    throw new ApiError(503, 'The property service is temporarily unavailable.');
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      response.status === 404 ? 'Not found' : 'The property service is temporarily unavailable.',
    );
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(503, 'The property service is waking up. Please try again shortly.');
  return response.json() as Promise<T>;
}
export const getListings = (query?: Record<string, string>) =>
  serverApi<Paginated<Listing>>(`/listings${queryString(query)}`);
export const getListing = (slug: string) =>
  serverApi<Listing>(`/listings/${encodeURIComponent(slug)}`);
export const getProjects = (query?: Record<string, string>) =>
  serverApi<Paginated<Project>>(`/projects${queryString(query)}`);
export const getProject = (slug: string) =>
  serverApi<Project>(`/projects/${encodeURIComponent(slug)}`);
export const getAreas = () => serverApi<Paginated<Area>>('/areas?limit=30');
