import type { Locale } from './api';
import type { SiteValues } from './admin-types';
export function siteText(
  values: SiteValues,
  key: string,
  locale: Locale,
  fallback: string,
): string {
  return values[key]?.[locale] ?? fallback;
}
