export type Locale = 'en' | 'ar';
export interface Media {
  id: string;
  url: string;
  altEn?: string;
  altAr?: string;
  width?: number;
  height?: number;
}
export interface Area {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  emirate: string;
  descriptionEn?: string;
  descriptionAr?: string;
}
export interface Agent {
  id: string;
  slug: string;
  displayName: string;
  publicEmail?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  reraNumber?: string | null;
  languages?: string[];
  photo?: Media | null;
}
export interface Listing {
  id: string;
  reference: string;
  slug: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  purpose: string;
  propertyType: string;
  completion: string;
  availability: string;
  furnishing: string;
  priceAed: string | null;
  priceOnRequest: boolean;
  previousPriceAed?: string | null;
  rentalPeriod?: string | null;
  areaSqm: string;
  areaSqft?: string;
  bedrooms: number;
  bathrooms: number;
  parking?: number;
  addressEn: string;
  addressAr: string;
  latitude?: string;
  longitude?: string;
  handoverDate?: string | null;
  vacantOn?: string | null;
  isExclusive: boolean;
  permitNumber?: string | null;
  permitUrl?: string | null;
  area: Area;
  media: Media[];
  agent: Agent | null;
  amenities: { id: string; slug: string; nameEn: string; nameAr: string }[];
  project?: { id: string; slug: string; nameEn: string; nameAr: string } | null;
}
export interface Project {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  startingPriceAed: string | null;
  priceOnRequest: boolean;
  handoverDate?: string | null;
  minBedrooms: number;
  maxBedrooms: number;
  propertyTypes: string[];
  area: Area;
  developer: { id: string; slug: string; nameEn: string; nameAr: string; website?: string | null };
  media: Media[];
  amenities: { id: string; slug: string; nameEn: string; nameAr: string }[];
  paymentPlan: { labelEn: string; labelAr: string; percentage: number }[];
  floorPlans: { nameEn: string; nameAr: string; bedrooms: number; areaSqm: string }[];
}
export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export function localized(object: unknown, base: string, locale: Locale): string {
  if (!object || typeof object !== 'object') return '';
  const value = object as Record<string, unknown>;
  return String(value[`${base}${locale === 'ar' ? 'Ar' : 'En'}`] ?? value[`${base}En`] ?? '');
}
export function formatMoney(
  value: string | number | null | undefined,
  locale: Locale = 'en',
): string {
  if (value === null || value === undefined || value === '')
    return locale === 'ar' ? 'السعر عند الطلب' : 'Price on request';
  return `${locale === 'ar' ? 'د.إ' : 'AED'} ${new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', { maximumFractionDigits: 0 }).format(Number(value))}`;
}
export function mediaUrl(url: string | undefined): string {
  if (!url) return '/images/property-01.webp';
  if (url.startsWith('/api/v1/')) return url.replace('/api/v1/', '/api/backend/v1/');
  if (url.startsWith('/images/')) return url;
  return '/images/property-01.webp';
}
export async function apiBrowser<T = Record<string, unknown>>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/backend/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      Array.isArray(body?.message)
        ? body.message.join('. ')
        : body?.message || 'Request could not be completed.',
    );
  if (body === null && response.status !== 204)
    throw new ApiError(503, 'The property service is temporarily unavailable.');
  return body as T;
}
