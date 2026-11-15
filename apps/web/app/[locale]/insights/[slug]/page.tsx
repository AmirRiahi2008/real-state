import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticle } from '@/lib/server-api';
import { ApiError, contentTypeLabel, localized, mediaUrl, type Locale } from '@/lib/api';
import RichContentRenderer from '@/components/rich-content';
export const dynamic = 'force-dynamic';
export default async function Insight({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  const ar = locale === 'ar';
  let article;
  try {
    article = await getArticle(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return (
    <article className="container page-shell section insight-article">
      <Link className="text-link" href={`/${locale}/insights`}>
        {ar ? 'جميع الرؤى' : 'All insights'}
      </Link>
      <p className="eyebrow">{contentTypeLabel(article.type, locale)}</p>
      <h1>{localized(article, 'title', locale)}</h1>
      <p className="section-description">{localized(article, 'excerpt', locale)}</p>
      {article.publishedAt && (
        <time dateTime={article.publishedAt}>
          {new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-AE', { dateStyle: 'long' }).format(
            new Date(article.publishedAt),
          )}
        </time>
      )}
      {article.cover && (
        <img
          className="insight-cover"
          src={mediaUrl(article.cover.url)}
          alt={localized(article, 'title', locale)}
        />
      )}
      <RichContentRenderer
        className="insight-body"
        locale={locale}
        document={ar ? article.bodyRichAr : article.bodyRichEn}
        plainText={localized(article, 'body', locale)}
      />
    </article>
  );
}
