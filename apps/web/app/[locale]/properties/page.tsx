import { getListings } from '@/lib/server-api';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, Search, SlidersHorizontal } from 'lucide-react';
import PropertyCard from '@/components/property-card';
import { type Locale } from '@/lib/api';
import './properties.css';

export const dynamic = 'force-dynamic';
const allowedFilters = [
  'q',
  'purpose',
  'propertyType',
  'emirate',
  'minPrice',
  'maxPrice',
  'bedrooms',
  'sort',
  'page',
];
const propertyTypes = [
  ['APARTMENT', 'Apartment', 'شقة'],
  ['VILLA', 'Villa', 'فيلا'],
  ['TOWNHOUSE', 'Townhouse', 'تاون هاوس'],
  ['PENTHOUSE', 'Penthouse', 'بنتهاوس'],
  ['STUDIO', 'Studio', 'استوديو'],
  ['OFFICE', 'Office', 'مكتب'],
  ['LAND', 'Land', 'أرض'],
];
const emirates = [
  ['DUBAI', 'Dubai', 'دبي'],
  ['ABU_DHABI', 'Abu Dhabi', 'أبوظبي'],
  ['SHARJAH', 'Sharjah', 'الشارقة'],
  ['AJMAN', 'Ajman', 'عجمان'],
  ['RAS_AL_KHAIMAH', 'Ras Al Khaimah', 'رأس الخيمة'],
  ['FUJAIRAH', 'Fujairah', 'الفجيرة'],
  ['UMM_AL_QUWAIN', 'Umm Al Quwain', 'أم القيوين'],
];

export default async function PropertiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale: rawLocale }, rawQuery] = await Promise.all([params, searchParams]);
  const locale: Locale = rawLocale === 'ar' ? 'ar' : 'en';
  const ar = locale === 'ar';
  const query: Record<string, string> = {};
  for (const key of allowedFilters) {
    const value = rawQuery[key];
    if (typeof value === 'string' && value.trim()) query[key] = value.trim();
  }
  let collection: Awaited<ReturnType<typeof getListings>> | null = null;
  let failed = false;
  try {
    collection = await getListings({ ...query, limit: '9' });
  } catch {
    failed = true;
  }
  function url(changes: Record<string, string>) {
    const values = new URLSearchParams({ ...query, ...changes });
    for (const [key, value] of values) if (!value) values.delete(key);
    return `/${locale}/properties?${values}`;
  }
  return (
    <div className="page-shell catalog-page">
      <section className="container catalog-page-heading">
        <div>
          <p className="eyebrow">{ar ? 'مساحتك. احتمالاتك.' : 'YOUR SPACE. YOUR POSSIBILITIES.'}</p>
          <h1>
            {ar ? (
              <>
                مكان يشبهك.
                <br />
                <span>وحياة تتسع لك.</span>
              </>
            ) : (
              <>
                Find your place.
                <br />
                <span>Make room for more.</span>
              </>
            )}
          </h1>
          <p>
            {ar
              ? 'استكشف منازل للبيع والإيجار في الإمارات. من أول مفتاح إلى فصل جديد تماماً.'
              : 'Explore homes to buy and rent across the Emirates. From your first set of keys to an entirely new chapter.'}
          </p>
        </div>
        <span className="catalog-heading-mark" aria-hidden="true">
          ↗
        </span>
      </section>
      <section
        className="container catalog-explorer"
        aria-label={ar ? 'البحث عن عقار' : 'Find a property'}
      >
        <div className="catalog-purpose-tabs">
          <Link
            className={!query.purpose || query.purpose === 'SALE' ? 'is-active' : ''}
            href={url({ purpose: 'SALE', page: '1' })}
          >
            {ar ? 'شراء منزل' : 'Find a home to buy'}
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
          <Link
            className={query.purpose === 'RENT' ? 'is-active' : ''}
            href={url({ purpose: 'RENT', page: '1' })}
          >
            {ar ? 'استئجار منزل' : 'Find a home to rent'}
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <form className="catalog-filter-form" method="GET" action={`/${locale}/properties`}>
          <div className="catalog-search-field">
            <Search size={19} aria-hidden="true" />
            <label className="catalog-sr-only" htmlFor="property-keyword">
              {ar ? 'اسم العقار أو المنطقة' : 'Property or location keyword'}
            </label>
            <input
              id="property-keyword"
              name="q"
              defaultValue={query.q ?? ''}
              maxLength={100}
              placeholder={
                ar ? 'منزل، حي، أو بداية جديدة…' : 'A neighbourhood, a home, a new beginning…'
              }
            />
          </div>
          <div className="catalog-filters-grid">
            <div className="field">
              <label htmlFor="property-purpose">{ar ? 'نوع العرض' : 'Looking to'}</label>
              <select
                className="input"
                id="property-purpose"
                name="purpose"
                defaultValue={query.purpose ?? ''}
              >
                <option value="">{ar ? 'شراء أو إيجار' : 'Buy or rent'}</option>
                <option value="SALE">{ar ? 'شراء' : 'Buy'}</option>
                <option value="RENT">{ar ? 'إيجار' : 'Rent'}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="property-emirate">{ar ? 'الإمارة' : 'Emirate'}</label>
              <select
                className="input"
                id="property-emirate"
                name="emirate"
                defaultValue={query.emirate ?? ''}
              >
                <option value="">{ar ? 'جميع الإمارات' : 'All Emirates'}</option>
                {emirates.map(([value, en, arabic]) => (
                  <option key={value} value={value}>
                    {ar ? arabic : en}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="property-type">{ar ? 'نوع العقار' : 'Property type'}</label>
              <select
                className="input"
                id="property-type"
                name="propertyType"
                defaultValue={query.propertyType ?? ''}
              >
                <option value="">{ar ? 'كل الأنواع' : 'All property types'}</option>
                {propertyTypes.map(([value, en, arabic]) => (
                  <option value={value} key={value}>
                    {ar ? arabic : en}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="property-bedrooms">{ar ? 'غرف النوم' : 'Bedrooms'}</label>
              <select
                className="input"
                id="property-bedrooms"
                name="bedrooms"
                defaultValue={query.bedrooms ?? ''}
              >
                <option value="">{ar ? 'أي عدد' : 'Any bedrooms'}</option>
                <option value="0">{ar ? 'استوديو' : 'Studio'}</option>
                {[1, 2, 3, 4, 5, 6].map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="property-min">{ar ? 'السعر من (درهم)' : 'Min. price (AED)'}</label>
              <input
                className="input"
                id="property-min"
                type="number"
                min="0"
                step="0.01"
                name="minPrice"
                defaultValue={query.minPrice ?? ''}
                placeholder="0"
                dir="ltr"
              />
            </div>
            <div className="field">
              <label htmlFor="property-max">{ar ? 'السعر إلى (درهم)' : 'Max. price (AED)'}</label>
              <input
                className="input"
                id="property-max"
                type="number"
                min="0"
                step="0.01"
                name="maxPrice"
                defaultValue={query.maxPrice ?? ''}
                placeholder={ar ? 'بدون حد' : 'No maximum'}
                dir="ltr"
              />
            </div>
          </div>
          <div className="catalog-filter-footer">
            <label className="catalog-sort">
              <SlidersHorizontal size={15} aria-hidden="true" />
              <span>{ar ? 'ترتيب حسب' : 'Sort by'}</span>
              <select
                name="sort"
                defaultValue={query.sort ?? 'recent'}
                aria-label={ar ? 'ترتيب العقارات' : 'Sort properties'}
              >
                <option value="recent">{ar ? 'الأحدث' : 'Latest additions'}</option>
                <option value="price_asc">
                  {ar ? 'السعر: الأقل أولاً' : 'Price: low to high'}
                </option>
                <option value="price_desc">
                  {ar ? 'السعر: الأعلى أولاً' : 'Price: high to low'}
                </option>
                <option value="area_desc">
                  {ar ? 'المساحة: الأكبر أولاً' : 'Space: largest first'}
                </option>
              </select>
            </label>
            <div className="catalog-filter-actions">
              <Link href={`/${locale}/properties`}>{ar ? 'مسح الفلاتر' : 'Clear filters'}</Link>
              <button className="button button-primary" type="submit">
                {ar ? 'اكتشف المساحات' : 'Explore spaces'}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </form>
      </section>
      <section
        className="container catalog-results"
        aria-label={ar ? 'نتائج البحث' : 'Property results'}
      >
        <div className="catalog-results-heading">
          <h2>
            {failed
              ? ar
                ? 'لنحاول من جديد.'
                : 'Let’s try that again.'
              : collection?.meta.total
                ? ar
                  ? `${collection.meta.total} مساحة تنتظر اكتشافك`
                  : `${collection.meta.total} spaces, countless possibilities`
                : ar
                  ? 'مساحتك موجودة في مكان ما.'
                  : 'Your place is out there.'}
          </h2>
          <span>{ar ? 'الإمارات العربية المتحدة' : 'United Arab Emirates'}</span>
        </div>
        {failed ? (
          <div className="error-state catalog-empty">
            <Search size={30} aria-hidden="true" />
            <h3>{ar ? 'تعذر تحميل العقارات.' : 'Our collection is taking a moment.'}</h3>
            <p>
              {ar
                ? 'لم نتمكن من الاتصال بقائمة العقارات. تحقق من الفلاتر أو أعد المحاولة.'
                : 'We couldn’t reach the property collection. Check your filters or try again shortly.'}
            </p>
            <Link href={`/${locale}/properties`} className="button button-outline">
              {ar ? 'إعادة المحاولة' : 'Try again'}
            </Link>
          </div>
        ) : collection?.data.length ? (
          <div className="property-grid catalog-property-grid">
            {collection.data.map((listing, index) => (
              <PropertyCard listing={listing} locale={locale} index={index} key={listing.id} />
            ))}
          </div>
        ) : (
          <div className="catalog-empty">
            <Search size={30} aria-hidden="true" />
            <h3>{ar ? 'لم نجد تطابقاً لهذه الفلاتر.' : 'No spaces match this search. Yet.'}</h3>
            <p>
              {ar
                ? 'جرب منطقة أخرى أو نطاق سعر أوسع. قد يكون منزلك القادم على بُعد نقرة.'
                : 'Try a different location or a wider price range. Your next chapter might be one filter away.'}
            </p>
            <Link className="button button-outline" href={`/${locale}/properties`}>
              {ar ? 'استكشف جميع العقارات' : 'Explore all properties'}
            </Link>
          </div>
        )}
        {collection && collection.meta.totalPages > 1 ? (
          <nav className="catalog-pagination" aria-label={ar ? 'صفحات النتائج' : 'Results pages'}>
            {collection.meta.page > 1 ? (
              <Link
                className="button button-outline"
                href={url({ page: String(collection.meta.page - 1) })}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {ar ? 'السابق' : 'Previous'}
              </Link>
            ) : (
              <span />
            )}
            <span>
              {ar
                ? `صفحة ${collection.meta.page} من ${collection.meta.totalPages}`
                : `Page ${collection.meta.page} of ${collection.meta.totalPages}`}
            </span>
            {collection.meta.page < collection.meta.totalPages ? (
              <Link
                className="button button-outline"
                href={url({ page: String(collection.meta.page + 1) })}
              >
                {ar ? 'التالي' : 'Next'}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
      <section className="container catalog-help-strip">
        <div>
          <p className="eyebrow">
            {ar ? 'رحلتك تستحق اهتماماً شخصياً' : 'SOME THINGS ARE BETTER TOGETHER'}
          </p>
          <h2>{ar ? 'لم تجد ما يشبهك بعد؟' : 'Haven’t found your kind of place?'}</h2>
          <p>
            {ar
              ? 'أخبرنا بما يجعل المكان مناسباً لك.'
              : 'Tell us what makes a place feel right to you.'}
          </p>
        </div>
        <Link href={`/${locale}/contact`} className="button button-primary">
          {ar ? 'تحدث معنا' : 'Let’s talk'}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
