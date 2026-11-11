import { getProjects } from '@/lib/server-api';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, Search } from 'lucide-react';
import { formatMoney, localized, mediaUrl, type Locale } from '@/lib/api';
import '../properties/properties.css';

export const dynamic = 'force-dynamic';
export default async function ProjectsPage({
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
  for (const key of ['q', 'emirate', 'propertyType', 'minPrice', 'maxPrice', 'sort', 'page']) {
    const value = rawQuery[key];
    if (typeof value === 'string' && value.trim()) query[key] = value.trim();
  }
  let collection: Awaited<ReturnType<typeof getProjects>> | null = null;
  let failed = false;
  try {
    collection = await getProjects({ ...query, limit: '8' });
  } catch {
    failed = true;
  }
  function pageUrl(page: number) {
    return `/${locale}/projects?${new URLSearchParams({ ...query, page: String(page) })}`;
  }
  return (
    <div className="page-shell catalog-page">
      <section className="container catalog-page-heading">
        <div>
          <p className="eyebrow">
            {ar ? 'مساحات الغد. فرص اليوم.' : 'TOMORROW’S SPACES. TODAY’S POSSIBILITIES.'}
          </p>
          <h1>
            {ar ? (
              <>
                تخيل ما
                <br />
                <span>يمكن أن يكون.</span>
              </>
            ) : (
              <>
                A little ahead
                <br />
                <span>of the everyday.</span>
              </>
            )}
          </h1>
          <p>
            {ar
              ? 'اكتشف مشاريع قيد الإنشاء، وخطط الدفع وتفاصيل المساحات. رحلة تبدأ بالفكرة وتتجه نحو مستقبلك.'
              : 'Discover off-plan communities, payment milestones and considered spaces. Every great address starts with a little imagination.'}
          </p>
        </div>
        <span className="catalog-heading-mark" aria-hidden="true">
          ↗
        </span>
      </section>
      <section
        className="container catalog-explorer"
        aria-label={ar ? 'البحث عن مشروع' : 'Find a project'}
      >
        <form method="GET" action={`/${locale}/projects`} className="catalog-filter-form">
          <div className="catalog-search-field">
            <Search size={19} aria-hidden="true" />
            <label className="catalog-sr-only" htmlFor="project-keyword">
              {ar ? 'البحث في المشاريع' : 'Search projects'}
            </label>
            <input
              id="project-keyword"
              name="q"
              maxLength={100}
              defaultValue={query.q ?? ''}
              placeholder={
                ar ? 'ابحث عن مشروع أو بداية جديدة…' : 'Find a project with your future in mind…'
              }
            />
          </div>
          <div className="catalog-filters-grid">
            <div className="field">
              <label htmlFor="project-emirate">{ar ? 'الإمارة' : 'Emirate'}</label>
              <select
                className="input"
                id="project-emirate"
                name="emirate"
                defaultValue={query.emirate ?? ''}
              >
                <option value="">{ar ? 'جميع الإمارات' : 'All Emirates'}</option>
                <option value="DUBAI">{ar ? 'دبي' : 'Dubai'}</option>
                <option value="ABU_DHABI">{ar ? 'أبوظبي' : 'Abu Dhabi'}</option>
                <option value="SHARJAH">{ar ? 'الشارقة' : 'Sharjah'}</option>
                <option value="RAS_AL_KHAIMAH">{ar ? 'رأس الخيمة' : 'Ras Al Khaimah'}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="project-type">{ar ? 'نوع العقار' : 'Space to suit you'}</label>
              <select
                className="input"
                id="project-type"
                name="propertyType"
                defaultValue={query.propertyType ?? ''}
              >
                <option value="">{ar ? 'جميع الأنواع' : 'All property types'}</option>
                <option value="APARTMENT">{ar ? 'شقة' : 'Apartment'}</option>
                <option value="VILLA">{ar ? 'فيلا' : 'Villa'}</option>
                <option value="TOWNHOUSE">{ar ? 'تاون هاوس' : 'Townhouse'}</option>
                <option value="PENTHOUSE">{ar ? 'بنتهاوس' : 'Penthouse'}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="project-sort">{ar ? 'الترتيب' : 'A fresh perspective'}</label>
              <select
                className="input"
                id="project-sort"
                name="sort"
                defaultValue={query.sort ?? 'recent'}
              >
                <option value="recent">{ar ? 'الأحدث' : 'Latest additions'}</option>
                <option value="price_asc">
                  {ar ? 'السعر: الأقل أولاً' : 'Price: low to high'}
                </option>
                <option value="price_desc">
                  {ar ? 'السعر: الأعلى أولاً' : 'Price: high to low'}
                </option>
                <option value="handover">{ar ? 'موعد التسليم' : 'Handover date'}</option>
              </select>
            </div>
          </div>
          <div className="catalog-filter-footer">
            <span className="muted">
              {ar ? 'خطط لمستقبلك، على مهل.' : 'A little room to plan ahead.'}
            </span>
            <div className="catalog-filter-actions">
              <Link href={`/${locale}/projects`}>{ar ? 'مسح الفلاتر' : 'Clear filters'}</Link>
              <button type="submit" className="button button-primary">
                {ar ? 'اكتشف المشاريع' : 'Explore projects'}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </form>
      </section>
      <section className="container catalog-results">
        <div className="catalog-results-heading">
          <h2>{ar ? 'مساحات تستحق التطلع إليها.' : 'Something to look forward to.'}</h2>
          <span>
            {collection
              ? `${collection.meta.total} ${ar ? 'مشروع' : 'projects'}`
              : ar
                ? 'مجموعة المشاريع'
                : 'The project collection'}
          </span>
        </div>
        {collection?.data.length ? (
          <div className="catalog-project-grid">
            {collection.data.map((project) => (
              <article key={project.id} className="catalog-project-card">
                <Link
                  href={`/${locale}/projects/${project.slug}`}
                  className="catalog-project-photo"
                  aria-label={localized(project, 'name', locale)}
                >
                  {project.media?.[0]?.url ? (
                    <img
                      src={mediaUrl(project.media[0].url)}
                      alt={
                        localized(project.media[0], 'alt', locale) ||
                        localized(project, 'name', locale)
                      }
                      width={1000}
                      height={680}
                      loading="lazy"
                    />
                  ) : (
                    <div className="catalog-image-empty">
                      {ar ? 'الصور قريباً' : 'A new perspective, coming soon'}
                    </div>
                  )}
                  <span className="catalog-card-tag">
                    {ar ? 'قيد الإنشاء' : 'A future address'}
                  </span>
                </Link>
                <div className="catalog-project-card-content">
                  <p className="eyebrow">{localized(project.developer, 'name', locale)}</p>
                  <Link href={`/${locale}/projects/${project.slug}`}>
                    <h2>{localized(project, 'name', locale)}</h2>
                  </Link>
                  <p className="catalog-card-location">
                    <MapPin size={14} aria-hidden="true" />
                    {localized(project.area, 'name', locale)}
                  </p>
                  <p>
                    {localized(project, 'description', locale).slice(0, 170)}
                    {localized(project, 'description', locale).length > 170 ? '…' : ''}
                  </p>
                  <div className="catalog-project-card-footer">
                    <div>
                      <span>{ar ? 'سعر البداية' : 'Starting from'}</span>
                      <strong>
                        {project.priceOnRequest
                          ? ar
                            ? 'عند الطلب'
                            : 'On request'
                          : formatMoney(project.startingPriceAed, locale)}
                      </strong>
                    </div>
                    <Link
                      href={`/${locale}/projects/${project.slug}`}
                      aria-label={ar ? 'استكشف المشروع' : 'Explore this project'}
                    >
                      <ArrowUpRight size={20} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="catalog-empty">
            <Search size={30} aria-hidden="true" />
            <h3>
              {failed
                ? ar
                  ? 'تعذر تحميل المشاريع حالياً.'
                  : 'Our future spaces are taking a moment.'
                : ar
                  ? 'لا توجد مشاريع مطابقة حالياً.'
                  : 'No projects match this search yet.'}
            </h3>
            <p>
              {failed
                ? ar
                  ? 'يرجى المحاولة مرة أخرى قريباً.'
                  : 'Please try again shortly.'
                : ar
                  ? 'وسع نطاق البحث أو تحدث معنا عن خططك.'
                  : 'Widen your search or tell us a little about your plans.'}
            </p>
            <Link className="button button-outline" href={`/${locale}/projects`}>
              {ar ? 'عرض جميع المشاريع' : 'See all projects'}
            </Link>
          </div>
        )}
        {collection && collection.meta.totalPages > 1 ? (
          <nav className="catalog-pagination" aria-label={ar ? 'صفحات المشاريع' : 'Project pages'}>
            {collection.meta.page > 1 ? (
              <Link className="button button-outline" href={pageUrl(collection.meta.page - 1)}>
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
              <Link className="button button-outline" href={pageUrl(collection.meta.page + 1)}>
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
          <p className="eyebrow">{ar ? 'فكر في الصورة الكاملة' : 'SEE THE BIGGER PICTURE'}</p>
          <h2>{ar ? 'فكرة اليوم. قرار مدروس غداً.' : 'A future worth thinking through.'}</h2>
          <p>
            {ar
              ? 'تعرف على الأرقام قبل اتخاذ خطوتك القادمة.'
              : 'Explore the numbers before making your next move.'}
          </p>
        </div>
        <Link href={`/${locale}/invest`} className="button button-primary">
          {ar ? 'خطط للاستثمار' : 'Plan your investment'}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
