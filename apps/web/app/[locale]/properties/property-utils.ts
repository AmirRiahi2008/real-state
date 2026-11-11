import { mediaUrl, type Locale } from '@/lib/api';
export function publicImageUrl(url?: string | null): string | undefined {
  return url ? mediaUrl(url) : undefined;
}
const labels: Record<string, [string, string]> = {
  APARTMENT: ['Apartment', 'شقة'],
  VILLA: ['Villa', 'فيلا'],
  TOWNHOUSE: ['Townhouse', 'تاون هاوس'],
  PENTHOUSE: ['Penthouse', 'بنتهاوس'],
  STUDIO: ['Studio', 'استوديو'],
  DUPLEX: ['Duplex', 'دوبلكس'],
  OFFICE: ['Office', 'مكتب'],
  RETAIL: ['Retail', 'متجر'],
  LAND: ['Land', 'أرض'],
  WAREHOUSE: ['Warehouse', 'مستودع'],
};
export function propertyTypeLabel(type: string, locale: Locale): string {
  return labels[type]?.[locale === 'ar' ? 1 : 0] ?? type;
}
