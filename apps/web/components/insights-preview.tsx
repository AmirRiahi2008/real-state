import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getArticles } from '@/lib/server-api';
import { localized, mediaUrl, contentTypeLabel, type Locale } from '@/lib/api';
import Reveal from './reveal';
export default async function InsightsPreview({ locale }: { locale: Locale }) {
  const result = await getArticles({ limit: '3' }).catch(() => null);
  if (!result?.data.length) return null;
  const ar = locale === 'ar';
  return (
    <section className="container section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{ar ? 'رؤى تستحق المشاركة' : 'A LITTLE MORE PERSPECTIVE'}</p>
          <h2>{ar ? 'رؤى وأدلة.' : 'Insights & ideas.'}</h2>
        </div>
        <Link className="text-link" href={`/${locale}/insights`}>
          {ar ? 'جميع المقالات' : 'All insights'}
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="property-grid">
        {result.data.map((article) => (
          <Reveal key={article.id}>
            <Link className="insight-card" href={`/${locale}/insights/${article.slug}`}>
              <img
                src={mediaUrl(article.cover?.url)}
                alt={localized(article, 'title', locale)}
                loading="lazy"
              />
              <div>
                <p className="eyebrow">{contentTypeLabel(article.type, locale)}</p>
                <h3>{localized(article, 'title', locale)}</h3>
                <p>{localized(article, 'excerpt', locale)}</p>
                <span className="text-link">
                  {ar ? 'اقرأ المزيد' : 'Read the story'}
                  <ArrowUpRight size={16} />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
