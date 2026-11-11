import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import InvestmentCalculator from '@/components/investment-calculator';
import type { Locale } from '@/lib/api';
import '../properties/properties.css';

export default async function InvestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = rawLocale === 'ar' ? 'ar' : 'en';
  const ar = locale === 'ar';
  const steps = ar
    ? [
        [
          '01 / افهم المكان',
          'الموقع قبل كل شيء.',
          'ما الذي يهمك: منزلك القادم، دخل إيجاري، أو خطة طويلة المدى؟ ابدأ بالمنطقة والمجتمع وكيف يمكن أن يتغير احتياجك.',
          'استكشف المساحات',
          `/${locale}/properties`,
        ],
        [
          '02 / انظر إلى التفاصيل',
          'ابحث أبعد من سعر الشراء.',
          'ضع الدفعة الأولى ورسوم المعاملات وتكاليف التمويل والخدمات والصيانة ضمن حساباتك. واترك مساحة لاحتمال الشغور.',
          'استكشف المشاريع',
          `/${locale}/projects`,
        ],
        [
          '03 / اختر على مهل',
          'حديث جيد يوضح الصورة.',
          'اسأل عن التوفر والعقود وجدول الدفعات والمستندات. اطلب مشورة مالية وقانونية مستقلة تناسب وضعك قبل اتخاذ القرار.',
          'تحدث معنا',
          `/${locale}/contact`,
        ],
      ]
    : [
        [
          '01 / KNOW YOUR PLACE',
          'Location comes first.',
          'A home for you, rental income or a longer-term plan? Start with the neighbourhood, its community and how your own needs might change.',
          'Explore the collection',
          `/${locale}/properties`,
        ],
        [
          '02 / LOOK A LITTLE CLOSER',
          'Look beyond the price tag.',
          'Consider your deposit, transaction fees, finance, service charges and maintenance. Leave room for the possibility of vacancy, too.',
          'Discover future spaces',
          `/${locale}/projects`,
        ],
        [
          '03 / TAKE YOUR TIME',
          'A conversation brings clarity.',
          'Ask about availability, contracts, payment schedules and documentation. Get independent financial and legal advice for your circumstances before deciding.',
          'Let’s talk it through',
          `/${locale}/contact`,
        ],
      ];
  return (
    <div className="page-shell catalog-invest-page">
      <section className="container catalog-invest-intro">
        <div>
          <p className="eyebrow">
            {ar ? 'من طموح اليوم إلى احتمالات الغد' : 'TODAY’S AMBITION. TOMORROW’S POSSIBILITIES.'}
          </p>
          <h1>
            {ar ? (
              <>
                مساحة لحياتك.
                <br />
                <span>ورؤية لمستقبلك.</span>
              </>
            ) : (
              <>
                Make room
                <br />
                for <span>your future.</span>
              </>
            )}
          </h1>
        </div>
        <p>
          {ar
            ? 'القرار المدروس يبدأ بصورة واضحة. استكشف أرقام التمويل والعائد الإيجاري باستخدام افتراضاتك، ثم ابدأ الحديث عن خطوتك القادمة.'
            : 'A considered decision starts with a clearer picture. Explore mortgage payments and rental yield using your own assumptions, then talk through your next step.'}
        </p>
      </section>
      <section
        className="container"
        aria-label={ar ? 'حاسبة الاستثمار' : 'Investment planning calculator'}
      >
        <InvestmentCalculator locale={locale} />
      </section>
      <section className="container catalog-invest-steps">
        {steps.map(([eyebrow, title, description, link, href]) => (
          <article className="catalog-invest-step" key={eyebrow}>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
            <p>{description}</p>
            <Link href={href}>
              {link}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </section>
      <section className="container catalog-help-strip">
        <div>
          <p className="eyebrow">{ar ? 'بداية تستحق التفكير' : 'A CONSIDERED BEGINNING'}</p>
          <h2>{ar ? 'مستقبلك، حسب خطتك.' : 'Your future, on your terms.'}</h2>
          <p>
            {ar ? 'لنتحدث عن مساحة تناسب خططك.' : 'Let’s talk about a space that fits your plans.'}
          </p>
        </div>
        <Link href={`/${locale}/contact`} className="button button-primary">
          {ar ? 'ابدأ الحديث' : 'Start a conversation'}
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
