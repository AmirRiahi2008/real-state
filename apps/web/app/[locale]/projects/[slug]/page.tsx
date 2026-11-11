import { getProject } from '@/lib/server-api';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Check, MapPin } from 'lucide-react';
import LeadForm from '@/components/lead-form';
import { propertyTypeLabel } from '../../properties/property-utils';
import { formatMoney, localized, mediaUrl, type Locale } from '@/lib/api';
import '../../properties/properties.css';

export const dynamic = 'force-dynamic';
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale: Locale = rawLocale === 'ar' ? 'ar' : 'en';
  const ar = locale === 'ar';
  let project: Awaited<ReturnType<typeof getProject>>;
  try {
    project = await getProject(slug);
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 404) notFound();
    return (
      <div className="page-shell container catalog-empty">
        <h1>{ar ? 'تعذر تحميل المشروع حالياً.' : 'This future address is taking a moment.'}</h1>
        <p>{ar ? 'يرجى المحاولة مرة أخرى قريباً.' : 'Please try again shortly.'}</p>
        <Link className="button button-primary" href={`/${locale}/projects`}>
          {ar ? 'استكشف المشاريع' : 'Back to projects'}
        </Link>
      </div>
    );
  }
  return (
    <div className="page-shell catalog-detail-page">
      <div className="container">
        <Link href={`/${locale}/projects`} className="catalog-back">
          <ArrowLeft size={16} aria-hidden="true" />
          {ar ? 'جميع المشاريع' : 'Back to all projects'}
        </Link>
        <div className="catalog-detail-heading">
          <div>
            <p className="eyebrow">
              {ar ? 'فصل جديد قيد التكوين' : 'YOUR NEXT CHAPTER, TAKING SHAPE'}
            </p>
            <h1>{localized(project, 'name', locale)}</h1>
            <p className="catalog-card-location">
              <MapPin size={16} aria-hidden="true" />
              {localized(project.area, 'name', locale)} ·{' '}
              {localized(project.developer, 'name', locale)}
            </p>
          </div>
          <div className="catalog-detail-price">
            <span>{ar ? 'سعر البداية' : 'Starting from'}</span>
            <strong>
              {project.priceOnRequest
                ? ar
                  ? 'السعر عند الطلب'
                  : 'Price on request'
                : formatMoney(project.startingPriceAed, locale)}
            </strong>
          </div>
        </div>
        <div className="catalog-project-hero">
          {project.media[0]?.url ? (
            <img
              src={mediaUrl(project.media[0].url)}
              alt={localized(project.media[0], 'alt', locale) || localized(project, 'name', locale)}
              width={1500}
              height={900}
              loading="eager"
            />
          ) : (
            <div className="catalog-image-empty">
              {ar ? 'صور المشروع قريباً' : 'Project photography coming soon'}
            </div>
          )}
        </div>
        <div className="catalog-detail-layout">
          <article className="catalog-detail-story">
            <section className="catalog-detail-section">
              <p className="eyebrow">{ar ? 'مساحة لفصل جديد' : 'A LITTLE ROOM TO LOOK AHEAD'}</p>
              <h2>
                {ar ? 'حياة جديدة، منذ الفكرة الأولى.' : 'A new way of living, from the ground up.'}
              </h2>
              <div className="catalog-description">
                {localized(project, 'description', locale)
                  .split(/\n\s*\n/)
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
              </div>
              <dl className="catalog-specifications">
                <div>
                  <dt>{ar ? 'المطور' : 'Developer'}</dt>
                  <dd>{localized(project.developer, 'name', locale)}</dd>
                </div>
                <div>
                  <dt>{ar ? 'الموقع' : 'Location'}</dt>
                  <dd>{localized(project.area, 'name', locale)}</dd>
                </div>
                <div>
                  <dt>{ar ? 'غرف النوم' : 'Bedrooms'}</dt>
                  <dd>
                    {project.minBedrooms === project.maxBedrooms
                      ? project.minBedrooms
                      : `${project.minBedrooms} – ${project.maxBedrooms}`}
                  </dd>
                </div>
                <div>
                  <dt>{ar ? 'نوع العقار' : 'Property types'}</dt>
                  <dd>
                    {project.propertyTypes
                      .map((type) => propertyTypeLabel(type, locale))
                      .join(' · ')}
                  </dd>
                </div>
                {project.handoverDate ? (
                  <div>
                    <dt>{ar ? 'التسليم المتوقع' : 'Estimated handover'}</dt>
                    <dd>
                      {new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-AE', {
                        month: 'long',
                        year: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(project.handoverDate))}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </section>
            {project.paymentPlan.length ? (
              <section className="catalog-detail-section">
                <p className="eyebrow">{ar ? 'خطوة تلو الأخرى' : 'ONE STEP AT A TIME'}</p>
                <h2>{ar ? 'خطة تعطي المستقبل شكلاً.' : 'A plan that puts it in perspective.'}</h2>
                <div className="catalog-payment-plan">
                  {project.paymentPlan.map((milestone, index) => (
                    <div className="catalog-payment-milestone" key={index}>
                      <strong>{milestone.percentage}%</strong>
                      <span>{localized(milestone, 'label', locale)}</span>
                    </div>
                  ))}
                </div>
                <p className="muted" style={{ fontSize: 11, lineHeight: 1.8, marginTop: 20 }}>
                  {ar
                    ? 'تفاصيل الخطة مقدمة ضمن العرض. تخضع للتوفر والعقد النهائي؛ اطلب جدول الدفعات الكامل قبل الالتزام.'
                    : 'Plan details are supplied with the listing, subject to availability and the final contract. Request the full payment schedule before committing.'}
                </p>
              </section>
            ) : null}
            {project.floorPlans.length ? (
              <section className="catalog-detail-section">
                <h2>{ar ? 'اختر المساحة التي تشبه حياتك.' : 'Make room for your kind of life.'}</h2>
                <div className="catalog-floor-plans">
                  {project.floorPlans.map((plan, index) => (
                    <div className="catalog-floor-plan" key={index}>
                      <h3>{localized(plan, 'name', locale)}</h3>
                      <p>
                        {plan.bedrooms} {ar ? 'غرف نوم' : 'bedrooms'} ·{' '}
                        {new Intl.NumberFormat(ar ? 'ar-AE' : 'en-AE').format(Number(plan.areaSqm))}{' '}
                        {ar ? 'متر مربع' : 'sq m'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {project.amenities.length ? (
              <section className="catalog-detail-section">
                <h2>
                  {ar ? 'تفاصيل تجعل الحياة أكثر اتساعاً.' : 'Life, with a little more to it.'}
                </h2>
                <ul className="catalog-amenities">
                  {project.amenities.map((amenity) => (
                    <li key={amenity.id}>
                      <Check size={17} aria-hidden="true" />
                      {localized(amenity, 'name', locale)}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div className="catalog-detail-next">
              <div>
                <h3>{ar ? 'تخيل يومك الأول هنا.' : 'Picture your first day here.'}</h3>
                <p>
                  {ar
                    ? 'أرسل طلبك لمعرفة المزيد عن التوفر وخطط الدفع.'
                    : 'Ask about availability, payment milestones and the finer details.'}
                </p>
              </div>
              <a
                href="#enquire"
                aria-label={ar ? 'الاستفسار عن المشروع' : 'Enquire about this project'}
              >
                <ArrowUpRight aria-hidden="true" />
              </a>
            </div>
          </article>
          <aside className="catalog-detail-aside" id="enquire">
            <LeadForm
              locale={locale}
              type="PROJECT"
              projectId={project.id}
              title={ar ? 'دع المستقبل يبدأ بحديث.' : 'Let’s talk about what comes next.'}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
