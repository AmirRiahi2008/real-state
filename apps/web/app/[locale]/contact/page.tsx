import Link from 'next/link';
import { ArrowUpRight, Compass, Handshake, MessageCircle } from 'lucide-react';
import LeadForm from '@/components/lead-form';
import type { Locale } from '@/lib/api';
import { getSiteContent } from '@/lib/server-api';
import { siteText } from '@/lib/site-content';
import '../properties/properties.css';

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = rawLocale === 'ar' ? 'ar' : 'en';
  const ar = locale === 'ar';
  const { values } = await getSiteContent();
  const text = (key: string, fallback: string) => siteText(values, key, locale, fallback);
  const points = ar
    ? [
        [
          'مساحة للحديث.',
          'من أول سؤال إلى أول مفتاح. أخبرنا بما تبحث عنه وما الذي يجعل المكان مناسباً لك.',
        ],
        ['صورة أوضح.', 'استكشف مناطق الإمارات وأنواع العقارات والتكاليف التي تناسب خططك.'],
        [
          'الخطوة المناسبة لك.',
          'شراء، إيجار، تقييم أو تمويل. سنراجع طلبك ونساعدك على استكشاف الخيارات.',
        ],
      ]
    : [
        [
          'Space for a conversation.',
          'From the first question to the first key. Tell us what matters and what makes a place feel right.',
        ],
        [
          'A clearer picture.',
          'Explore the Emirates, property types and the costs that fit the way you want to live.',
        ],
        [
          'Your kind of next step.',
          'Buying, renting, valuing or financing. We’ll review your request and help you explore the possibilities.',
        ],
      ];
  const icons = [MessageCircle, Compass, Handshake];
  return (
    <div className="page-shell catalog-contact-page">
      <section className="container catalog-contact-layout">
        <div className="catalog-contact-copy">
          <p className="eyebrow">
            {text(
              'contact.eyebrow',
              ar ? 'الأماكن العظيمة تبدأ بالناس' : 'GREAT PLACES START WITH PEOPLE',
            )}
          </p>
          <h1>
            {text('contact.title1', ar ? 'لديك فكرة؟' : 'Big plans?')}
            <br />
            <span>{text('contact.title2', ar ? 'لنتحدث عنها.' : 'Small question?')}</span>
            {text('contact.title3', ar ? '' : 'We’re here.') ? (
              <>
                <br />
                {text('contact.title3', ar ? '' : 'We’re here.')}
              </>
            ) : null}
          </h1>
          <p>
            {text(
              'contact.description',
              ar
                ? 'كل خطوة جديدة تبدأ بحديث. أخبرنا عن خططك وسنساعدك في استكشاف ما يمكن أن يأتي بعدها.'
                : 'Every next chapter starts with a conversation. Tell us a little about your plans, and we’ll help you explore what could come next.',
            )}
          </p>
          <ul className="catalog-contact-points">
            {points.map(([title, description], index) => {
              const Icon = icons[index];
              return (
                <li key={title}>
                  {Icon ? <Icon size={21} aria-hidden="true" /> : null}
                  <div>
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="catalog-contact-note">
            {ar
              ? 'تبحث عن عقار محدد؟ افتح صفحة العقار وأرسل استفسارك أو طلب المعاينة من هناك، ليصل طلبك مع تفاصيل المساحة التي اخترتها.'
              : 'Have a particular home in mind? Open its property page to ask a question or request a viewing, so your request includes the space you’ve chosen.'}
            <br />
            <Link
              href={`/${locale}/properties`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 12,
                textDecoration: 'underline',
                textUnderlineOffset: 4,
              }}
            >
              {ar ? 'استكشف مجموعة العقارات' : 'Explore the property collection'}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <LeadForm locale={locale} type="VALUATION" />
      </section>
    </div>
  );
}
