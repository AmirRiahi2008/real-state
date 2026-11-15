import Link from 'next/link';
import { getArticles } from '@/lib/server-api';
import { contentTypeLabel, localized, mediaUrl, type Locale } from '@/lib/api';
export const dynamic = 'force-dynamic';
const contentTypes = ['NEWS', 'ARTICLE', 'AREA_GUIDE', 'MARKET_REPORT', 'BUYER_GUIDE', 'SERVICE'];
export default async function Insights({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const { locale } = await params;
  const ar = locale === 'ar';
  const query = await searchParams;
  const page = /^\d+$/.test(query.page ?? '')
    ? String(Math.max(1, Math.min(1000, Number(query.page))))
    : '1';
  const type = contentTypes.includes(query.type ?? '') ? query.type! : '';
  const result = await getArticles({ page, limit: '9', ...(type ? { type } : {}) }).catch(
    () => null,
  );
  function href(category: string, targetPage = 1) {
    const params = new URLSearchParams();
    if (category) params.set('type', category);
    if (targetPage > 1) params.set('page', String(targetPage));
    return `/${locale}/insights${params.size ? `?${params}` : ''}`;
  }
  return (
    <div className="container page-shell section">
      <p className="eyebrow">{ar ? 'رؤى من الإمارات' : 'PERSPECTIVES FROM THE EMIRATES'}</p>
      <h1>{ar ? 'أخبار ورؤى وأدلة.' : 'News, insights & guides.'}</h1>
      <p className="section-description">
        {ar
          ? 'مساحة لفهم أفضل للمكان وخطوتك القادمة.'
          : 'A little more context for the places we live, and the steps we take next.'}
      </p>
      <nav className="insight-filters" aria-label={ar ? 'نوع المحتوى' : 'Content categories'}>
        {['', ...contentTypes].map((category) => (
          <Link
            key={category || 'all'}
            className={category === type ? 'is-active' : ''}
            aria-current={category === type ? 'page' : undefined}
            href={href(category)}
          >
            {category ? contentTypeLabel(category, locale) : ar ? 'الكل' : 'All insights'}
          </Link>
        ))}
      </nav>
      {!result ? (
        <p role="alert">
          {ar
            ? 'المحتوى غير متاح مؤقتاً. حاول مجدداً.'
            : 'Insights are temporarily unavailable. Please try again.'}
        </p>
      ) : !result.data.length ? (
        <div className="empty-collection">
          {ar ? 'رؤى جديدة قريباً.' : 'New perspectives are on their way.'}
        </div>
      ) : (
        <>
          <div className="property-grid">
            {result.data.map((article) => (
              <Link
                key={article.id}
                className="insight-card"
                href={`/${locale}/insights/${article.slug}`}
              >
                <img
                  src={mediaUrl(article.cover?.url)}
                  alt={localized(article, 'title', locale)}
                  loading="lazy"
                />
                <div>
                  <p className="eyebrow">{contentTypeLabel(article.type, locale)}</p>
                  <h2>{localized(article, 'title', locale)}</h2>
                  <p>{localized(article, 'excerpt', locale)}</p>
                </div>
              </Link>
            ))}
          </div>
          <nav className="insight-pagination" aria-label={ar ? 'صفحات المقالات' : 'Insight pages'}>
            {result.meta.page > 1 && (
              <Link className="button button-outline" href={href(type, result.meta.page - 1)}>
                {ar ? 'السابق' : 'Previous'}
              </Link>
            )}
            <span>
              {result.meta.page} / {Math.max(1, result.meta.totalPages)}
            </span>
            {result.meta.page < result.meta.totalPages && (
              <Link className="button button-outline" href={href(type, result.meta.page + 1)}>
                {ar ? 'التالي' : 'Next'}
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
