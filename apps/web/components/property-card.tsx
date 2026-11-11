'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Bath, BedDouble, MapPin, MoveUpRight, Ruler } from 'lucide-react';
import { formatMoney, localized, type Listing, type Locale } from '@/lib/api';
import { propertyTypeLabel, publicImageUrl } from '@/app/[locale]/properties/property-utils';
import '@/app/[locale]/properties/properties.css';

export function PropertyCard({
  listing,
  locale,
  index = 0,
}: {
  listing: Listing;
  locale: Locale;
  index?: number;
}) {
  const reduced = useReducedMotion();
  const ar = locale === 'ar';
  const image = listing.media?.[0];
  const href = `/${locale}/properties/${listing.slug}`;
  return (
    <motion.article
      className="property-card catalog-property-card"
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.55, delay: Math.min(index % 3, 2) * 0.08 }}
    >
      <Link
        className="catalog-card-image"
        href={href}
        aria-label={localized(listing, 'title', locale)}
      >
        {image?.url ? (
          <img
            src={publicImageUrl(image.url)}
            alt={localized(image, 'alt', locale) || localized(listing, 'title', locale)}
            loading="lazy"
            width={720}
            height={540}
          />
        ) : (
          <div className="catalog-image-empty">
            <Ruler aria-hidden="true" />
            <span>{ar ? 'الصور قريباً' : 'A new perspective, coming soon'}</span>
          </div>
        )}
        <span className="catalog-card-tag">
          {listing.purpose === 'RENT' ? (ar ? 'للإيجار' : 'For rent') : ar ? 'للبيع' : 'For sale'}
        </span>
        {listing.completion === 'OFF_PLAN' ? (
          <span className="catalog-card-status">{ar ? 'قيد الإنشاء' : 'Off-plan'}</span>
        ) : null}
        <span className="catalog-card-arrow">
          <ArrowUpRight size={20} aria-hidden="true" />
        </span>
      </Link>
      <div className="catalog-card-content">
        <div className="catalog-card-type">
          {propertyTypeLabel(listing.propertyType, locale)}
          <span>
            {listing.isExclusive
              ? ar
                ? 'اختيار مميز'
                : 'Curated selection'
              : ar
                ? 'مكان لتنتمي'
                : 'A place to belong'}
          </span>
        </div>
        <Link href={href} className="catalog-card-title">
          <h3>{localized(listing, 'title', locale)}</h3>
        </Link>
        <p className="catalog-card-location">
          <MapPin size={14} aria-hidden="true" />
          {localized(listing.area, 'name', locale)}
        </p>
        <div className="catalog-card-facts">
          <span>
            <BedDouble size={16} aria-hidden="true" />
            {listing.bedrooms === 0
              ? ar
                ? 'استوديو'
                : 'Studio'
              : `${listing.bedrooms} ${ar ? 'غرف' : 'beds'}`}
          </span>
          <span>
            <Bath size={16} aria-hidden="true" />
            {listing.bathrooms} {ar ? 'حمام' : 'baths'}
          </span>
          <span>
            <Ruler size={16} aria-hidden="true" />
            {new Intl.NumberFormat(ar ? 'ar-AE' : 'en-AE', { maximumFractionDigits: 0 }).format(
              Number(listing.areaSqft ?? Number(listing.areaSqm) * 10.7639),
            )}{' '}
            {ar ? 'قدم²' : 'sq ft'}
          </span>
        </div>
        <div className="catalog-card-bottom">
          <strong>
            {listing.priceOnRequest
              ? ar
                ? 'السعر عند الطلب'
                : 'Price on request'
              : formatMoney(listing.priceAed, locale)}
            {listing.purpose === 'RENT' && listing.rentalPeriod ? (
              <small>
                {' '}
                /{' '}
                {
                  (
                    {
                      YEAR: ar ? 'سنة' : 'year',
                      MONTH: ar ? 'شهر' : 'month',
                      WEEK: ar ? 'أسبوع' : 'week',
                      DAY: ar ? 'يوم' : 'day',
                    } as Record<string, string>
                  )[listing.rentalPeriod]
                }
              </small>
            ) : null}
          </strong>
          <Link href={href} aria-label={ar ? 'استكشف العقار' : 'Explore this home'}>
            <MoveUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}
export default PropertyCard;
