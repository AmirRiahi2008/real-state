import { getListing } from '@/lib/server-api';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  Bath,
  BedDouble,
  CalendarDays,
  Car,
  Check,
  MapPin,
  Ruler,
} from 'lucide-react';
import LeadForm from '@/components/lead-form';
import { propertyTypeLabel, publicImageUrl } from '../property-utils';
import { formatMoney, localized, type Locale } from '@/lib/api';
import '../properties.css';

export const dynamic = 'force-dynamic';
export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale: Locale = rawLocale === 'ar' ? 'ar' : 'en';
  const ar = locale === 'ar';
  let listing: Awaited<ReturnType<typeof getListing>>;
  try {
    listing = await getListing(slug);
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) notFound();
    return (
      <div className="page-shell container catalog-empty error-state">
        <h1>{ar ? 'تعذر تحميل هذا العقار.' : 'This home is taking a moment.'}</h1>
        <p>{ar ? 'يرجى إعادة المحاولة قريباً.' : 'Please try again shortly.'}</p>
        <Link className="button button-primary" href={`/${locale}/properties`}>
          {ar ? 'استكشف العقارات' : 'Back to the collection'}
        </Link>
      </div>
    );
  }
  const name = localized(listing, 'title', locale);
  const address = localized(listing, 'address', locale);
  const images = listing.media ?? [];
  const number = new Intl.NumberFormat(ar ? 'ar-AE' : 'en-AE', { maximumFractionDigits: 0 });
  return (
    <div className="page-shell catalog-detail-page">
      <div className="container">
        <Link href={`/${locale}/properties`} className="catalog-back">
          <ArrowLeft size={16} aria-hidden="true" />
          {ar ? 'جميع العقارات' : 'Back to all properties'}
        </Link>
        <div className="catalog-detail-heading">
          <div>
            <p className="eyebrow">
              {propertyTypeLabel(listing.propertyType, locale)} ·{' '}
              {listing.purpose === 'RENT'
                ? ar
                  ? 'للإيجار'
                  : 'FOR RENT'
                : ar
                  ? 'للبيع'
                  : 'FOR SALE'}
            </p>
            <h1>{name}</h1>
            <p className="catalog-card-location">
              <MapPin size={16} aria-hidden="true" />
              {address} · {localized(listing.area, 'name', locale)}
            </p>
          </div>
          <div className="catalog-detail-price">
            <span>
              {listing.priceOnRequest
                ? ar
                  ? 'لنتحدث عن التفاصيل'
                  : 'Let’s discuss the details'
                : ar
                  ? 'مساحتك القادمة من'
                  : 'Your next chapter from'}
            </span>
            <strong>
              {listing.priceOnRequest
                ? ar
                  ? 'السعر عند الطلب'
                  : 'Price on request'
                : formatMoney(listing.priceAed, locale)}
            </strong>
            {listing.purpose === 'RENT' ? (
              <small>
                {ar
                  ? 'وفق مدة الإيجار المحددة في العرض'
                  : `Per ${listing.rentalPeriod?.toLowerCase() ?? 'rental period'}`}
              </small>
            ) : null}
          </div>
        </div>
        <div className={`catalog-gallery ${images.length < 2 ? 'catalog-gallery-single' : ''}`}>
          {images.length ? (
            images.slice(0, 3).map((image, index) => (
              <a
                href={publicImageUrl(image.url)}
                target="_blank"
                rel="noreferrer"
                className={`catalog-gallery-image catalog-gallery-image-${index}`}
                key={image.id}
                aria-label={
                  ar ? `فتح صورة العقار ${index + 1}` : `Open property image ${index + 1}`
                }
              >
                <img
                  src={publicImageUrl(image.url)}
                  alt={localized(image, 'alt', locale) || name}
                  width={1200}
                  height={900}
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
                {index === 0 ? (
                  <span className="catalog-gallery-label">
                    {ar ? 'مساحة لحياة مختلفة' : 'A little room for a different life'}
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </span>
                ) : null}
              </a>
            ))
          ) : (
            <div className="catalog-image-empty">
              <Ruler aria-hidden="true" />
              <p>{ar ? 'الصور قريباً' : 'Property photography coming soon'}</p>
            </div>
          )}
        </div>
        <div className="catalog-detail-layout">
          <article className="catalog-detail-story">
            <div className="catalog-detail-facts">
              <div>
                <BedDouble aria-hidden="true" />
                <strong>
                  {listing.bedrooms === 0 ? (ar ? 'استوديو' : 'Studio') : listing.bedrooms}
                </strong>
                <span>{ar ? 'غرف النوم' : 'Bedrooms'}</span>
              </div>
              <div>
                <Bath aria-hidden="true" />
                <strong>{listing.bathrooms}</strong>
                <span>{ar ? 'الحمامات' : 'Bathrooms'}</span>
              </div>
              <div>
                <Ruler aria-hidden="true" />
                <strong>
                  {number.format(Number(listing.areaSqft ?? Number(listing.areaSqm) * 10.7639))}
                </strong>
                <span>{ar ? 'قدم مربع' : 'Square feet'}</span>
              </div>
              <div>
                <Car aria-hidden="true" />
                <strong>{listing.parking ?? 0}</strong>
                <span>{ar ? 'مواقف السيارات' : 'Parking spaces'}</span>
              </div>
            </div>
            <section className="catalog-detail-section">
              <p className="eyebrow">{ar ? 'تخيل حياتك هنا' : 'PICTURE LIFE HERE'}</p>
              <h2>{ar ? 'أكثر من مجرد عنوان.' : 'More than an address.'}</h2>
              <div className="catalog-description">
                {localized(listing, 'description', locale)
                  .split(/\n\s*\n/)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>
            </section>
            <section className="catalog-detail-section">
              <h2>{ar ? 'التفاصيل الصغيرة تصنع الفارق.' : 'It’s the little things.'}</h2>
              <dl className="catalog-specifications">
                <div>
                  <dt>{ar ? 'المساحة الداخلية' : 'Internal area'}</dt>
                  <dd>
                    {number.format(Number(listing.areaSqm))} {ar ? 'متر²' : 'sq m'}
                  </dd>
                </div>
                <div>
                  <dt>{ar ? 'حالة الإنجاز' : 'Completion'}</dt>
                  <dd>
                    {listing.completion === 'READY'
                      ? ar
                        ? 'جاهز'
                        : 'Ready to make yours'
                      : ar
                        ? 'قيد الإنشاء'
                        : 'Off-plan'}
                  </dd>
                </div>
                <div>
                  <dt>{ar ? 'التأثيث' : 'Furnishing'}</dt>
                  <dd>
                    {(
                      {
                        FURNISHED: ar ? 'مفروش' : 'Furnished',
                        SEMI_FURNISHED: ar ? 'مفروش جزئياً' : 'Partly furnished',
                        UNFURNISHED: ar ? 'غير مفروش' : 'Unfurnished',
                      } as Record<string, string>
                    )[listing.furnishing] ?? listing.furnishing}
                  </dd>
                </div>
                <div>
                  <dt>{ar ? 'الرقم المرجعي' : 'Property reference'}</dt>
                  <dd dir="ltr">{listing.reference}</dd>
                </div>
                {listing.handoverDate ? (
                  <div>
                    <dt>{ar ? 'التسليم المتوقع' : 'Estimated handover'}</dt>
                    <dd>
                      {new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-AE', {
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(listing.handoverDate))}
                    </dd>
                  </div>
                ) : null}
                {listing.permitNumber ? (
                  <div>
                    <dt>{ar ? 'رقم التصريح المقدم' : 'Supplied permit number'}</dt>
                    <dd>
                      {listing.permitUrl ? (
                        <a href={listing.permitUrl} target="_blank" rel="noreferrer">
                          {listing.permitNumber}
                          <ArrowUpRight size={12} aria-hidden="true" />
                        </a>
                      ) : (
                        listing.permitNumber
                      )}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
            {listing.amenities?.length ? (
              <section className="catalog-detail-section">
                <h2>{ar ? 'حياة بمساحة أكبر.' : 'A little more to come home to.'}</h2>
                <ul className="catalog-amenities">
                  {listing.amenities.map((amenity) => (
                    <li key={amenity.id}>
                      <Check size={17} aria-hidden="true" />
                      {localized(amenity, 'name', locale)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {listing.agent ? (
              <section className="catalog-agent-panel">
                <span className="catalog-agent-avatar">
                  {listing.agent.displayName.slice(0, 1)}
                </span>
                <div>
                  <p className="eyebrow">
                    {ar ? 'شخص يفهم خطوتك القادمة' : 'A PERSON IN YOUR CORNER'}
                  </p>
                  <h3>{listing.agent.displayName}</h3>
                  <p>{listing.agent.languages?.join(' · ')}</p>
                  {listing.agent.reraNumber ? (
                    <small>
                      {ar ? 'رقم الترخيص المقدم' : 'Supplied broker licence'}:{' '}
                      {listing.agent.reraNumber}
                    </small>
                  ) : null}
                </div>
                <a href="#enquire" className="button button-outline">
                  {ar ? 'تواصل' : 'Say hello'}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </section>
            ) : null}
            <div className="catalog-detail-next">
              <CalendarDays size={21} aria-hidden="true" />
              <div>
                <h3>
                  {ar
                    ? 'أفضل طريقة لتشعر بالمكان؟ أن تراه.'
                    : 'The best way to feel a place? Be there.'}
                </h3>
                <p>
                  {ar
                    ? 'أرسل طلب معاينة واختر الوقت المناسب لك.'
                    : 'Request a viewing and choose a time that works for you.'}
                </p>
              </div>
              <a href="#enquire" aria-label={ar ? 'طلب معاينة' : 'Request a viewing'}>
                <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          </article>
          <aside className="catalog-detail-aside" id="enquire">
            <LeadForm locale={locale} listingId={listing.id} type="ENQUIRY" />
          </aside>
        </div>
      </div>
    </div>
  );
}
