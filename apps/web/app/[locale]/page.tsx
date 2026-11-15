import { getListings, getProjects, getAreas, getSiteContent } from '@/lib/server-api';
import Link from 'next/link';
import { siteText } from '@/lib/site-content';
import InsightsPreview from '@/components/insights-preview';
import { Suspense } from 'react';
import {
  ArrowUpRight,
  MoveUpRight,
  Compass,
  Heart,
  ScanLine,
  ArrowDownRight,
  Layers3,
} from 'lucide-react';
import ScrollStory from '@/components/scroll-story';
import PropertyCard from '@/components/property-card';
import Reveal from '@/components/reveal';
import Faq from '@/components/faq';
import { localized, formatMoney, mediaUrl, type Locale } from '@/lib/api';

const emirateNames: Record<string, [string, string]> = {
  DUBAI: ['DUBAI', 'دبي'],
  ABU_DHABI: ['ABU DHABI', 'أبوظبي'],
  SHARJAH: ['SHARJAH', 'الشارقة'],
  AJMAN: ['AJMAN', 'عجمان'],
  RAS_AL_KHAIMAH: ['RAS AL KHAIMAH', 'رأس الخيمة'],
  FUJAIRAH: ['FUJAIRAH', 'الفجيرة'],
  UMM_AL_QUWAIN: ['UMM AL QUWAIN', 'أم القيوين'],
};

export const dynamic = 'force-dynamic';
export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return (
    <>
      <ScrollStory locale={locale} />
      <Suspense
        fallback={
          <div className="container section collection-loading" aria-live="polite">
            <span className="status-dot" />
            <p>
              {locale === 'ar'
                ? 'نحضّر مجموعة تستحق الاكتشاف…'
                : 'A collection worth discovering is on its way…'}
            </p>
          </div>
        }
      >
        <HomeSections locale={locale} />
      </Suspense>
    </>
  );
}
async function HomeSections({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const { values } = await getSiteContent();
  const text = (key: string, fallback: string) => siteText(values, key, locale, fallback);
  const [listingsResult, projectsResult, areasResult] = await Promise.allSettled([
    getListings({ limit: '3' }),
    getProjects({ limit: '3' }),
    getAreas(),
  ]);
  const listings = listingsResult.status === 'fulfilled' ? listingsResult.value.data : [];
  const projects = projectsResult.status === 'fulfilled' ? projectsResult.value.data : [];
  const areas = areasResult.status === 'fulfilled' ? areasResult.value.data.slice(0, 3) : [];
  return (
    <>
      <div className="values-ribbon" aria-hidden="true">
        <span>{ar ? 'أماكن تحمل معنى' : 'PLACES WITH PURPOSE'}</span>
        <span>{ar ? 'مساحات لها روح' : 'SPACES WITH SOUL'}</span>
        <span>{ar ? 'رؤية أوسع للغد' : 'A DIFFERENT TOMORROW'}</span>
      </div>

      <section className="section featured-section container" id="discover">
        <Reveal>
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span className="status-dot" />
                {text(
                  'home.featuredEyebrow',
                  ar ? 'مجموعة مختارة بعناية' : 'A CONSIDERED COLLECTION',
                )}
              </p>
              <h2>
                {text('home.featuredTitle1', ar ? 'أكثر من عنوان.' : 'More than an address.')}
                <br />
                <em>{text('home.featuredTitle2', ar ? 'منظور للحياة.' : 'A point of view.')}</em>
              </h2>
            </div>
            <div className="section-heading-aside">
              <p>
                {text(
                  'home.featuredDescription',
                  ar
                    ? 'مساحات مختلفة لطموحات مختلفة. ابحث عن المكان الذي يشبه خطوتك القادمة.'
                    : 'Different spaces. Different ambitions. Find the place that feels like your next move.',
                )}
              </p>
              <Link href={`/${locale}/properties`} className="text-link">
                {ar ? 'جميع العقارات' : 'Explore all properties'}
                <ArrowUpRight size={18} />
              </Link>
            </div>
          </div>
        </Reveal>
        <form className="home-search" action={`/${locale}/properties`}>
          <div className="search-field">
            <label htmlFor="home-purpose">{ar ? 'أبحث عن' : 'I’m looking to'}</label>
            <select id="home-purpose" name="purpose">
              <option value="SALE">{ar ? 'الشراء' : 'Buy a home'}</option>
              <option value="RENT">{ar ? 'الاستئجار' : 'Rent a home'}</option>
            </select>
          </div>
          <div className="search-field">
            <label htmlFor="home-location">{ar ? 'الموقع' : 'Location'}</label>
            <select id="home-location" name="emirate">
              <option value="">{ar ? 'في جميع الإمارات' : 'Anywhere in the UAE'}</option>
              <option value="DUBAI">{ar ? 'دبي' : 'Dubai'}</option>
              <option value="ABU_DHABI">{ar ? 'أبوظبي' : 'Abu Dhabi'}</option>
            </select>
          </div>
          <div className="search-field">
            <label htmlFor="home-type">{ar ? 'نوع العقار' : 'Property type'}</label>
            <select id="home-type" name="propertyType">
              <option value="">{ar ? 'جميع الأنواع' : 'A little bit of everything'}</option>
              <option value="APARTMENT">{ar ? 'شقة' : 'Apartment'}</option>
              <option value="VILLA">{ar ? 'فيلا' : 'Villa'}</option>
              <option value="PENTHOUSE">{ar ? 'بنتهاوس' : 'Penthouse'}</option>
              <option value="TOWNHOUSE">{ar ? 'تاون هاوس' : 'Townhouse'}</option>
            </select>
          </div>
          <button className="button button-primary" type="submit">
            {ar ? 'لنكتشف' : 'Let’s find it'}
            <ArrowUpRight size={18} />
          </button>
        </form>
        {listings.length > 0 ? (
          <div className="property-grid">
            {listings.map((listing, index) => (
              <Reveal key={listing.id} delay={index * 0.08}>
                <PropertyCard listing={listing} locale={locale} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="empty-collection">
            <p>
              {ar
                ? 'نعيد تجهيز المجموعة. استكشف الخيارات أو حاول مجدداً بعد قليل.'
                : 'Our collection is taking a moment to load. Please explore again shortly.'}
            </p>
            <Link className="button button-outline" href={`/${locale}/properties`}>
              {ar ? 'استكشف العقارات' : 'Explore properties'}
            </Link>
          </div>
        )}
        <p className="collection-note">
          {ar
            ? 'مجموعة تجريبية · الأسعار والتصاميم المعروضة لأغراض العرض'
            : 'A demonstration collection. Properties and prices are illustrative.'}
        </p>
      </section>

      <section className="perspective-section section">
        <div className="container perspective-layout">
          <Reveal className="perspective-image">
            <img
              src="/images/property-04.webp"
              alt={
                ar
                  ? 'تصميم داخلي مضيء بمواد طبيعية — صورة توضيحية'
                  : 'Light-filled interior with natural materials — illustrative image'
              }
              loading="lazy"
            />
            <div className="image-orbit-sticker">
              <span>{ar ? 'صُمّمت للحياة' : 'MADE FOR LIVING'}</span>
              <span>{ar ? 'مع مساحة للأحلام' : 'WITH ROOM TO DREAM'}</span>
            </div>
            <div className="photo-caption">
              <span>{ar ? 'تفاصيل تستحق الانتباه.' : 'The little things are the big things.'}</span>
              <ArrowUpRight size={19} />
            </div>
          </Reveal>
          <div className="perspective-copy">
            <Reveal>
              <p className="eyebrow">
                {text(
                  'home.perspectiveEyebrow',
                  ar ? 'ما نراه، مختلف' : 'A DIFFERENT WAY OF SEEING',
                )}
              </p>
              <h2>
                {text('home.perspectiveTitle1', ar ? 'عقارات.' : 'Real estate.')}
                <br />
                <em>{text('home.perspectiveTitle2', ar ? 'بلمسة إنسانية.' : 'More human.')}</em>
              </h2>
              <p className="section-description">
                {text(
                  'home.perspectiveDescription',
                  ar
                    ? 'نرى وراء الأمتار المربعة. في إيقاع الحي، ودفء المواد، والشعور الذي يستقبلك عند الدخول.'
                    : 'We look beyond the square metres. To the rhythm of a neighbourhood. The warmth of a material. The feeling you get when you walk through the door.',
                )}
              </p>
            </Reveal>
            {[
              {
                icon: Compass,
                en: [
                  'A place that fits',
                  'From a first home to a fresh start, explore spaces around the way you want to live.',
                ],
                ar: [
                  'مكان يلائمك',
                  'من أول منزل إلى بداية جديدة، اكتشف المساحات التي تناسب أسلوب حياتك.',
                ],
              },
              {
                icon: Heart,
                en: [
                  'Details that matter',
                  'Natural light. Outdoor space. A thoughtful layout. Discover what makes a place feel right.',
                ],
                ar: [
                  'تفاصيل تُحدث فرقاً',
                  'ضوء طبيعي ومساحات خارجية وتوزيع مدروس. اكتشف ما يمنح المكان إحساسه الخاص.',
                ],
              },
              {
                icon: ScanLine,
                en: [
                  'A clearer perspective',
                  'Compare homes, understand the numbers, and ask the questions that help you move forward.',
                ],
                ar: [
                  'رؤية أكثر وضوحاً',
                  'قارن العقارات وافهم الأرقام واطرح الأسئلة التي تساعدك على اتخاذ خطوتك التالية.',
                ],
              },
            ].map((item, index) => (
              <Reveal className="perspective-value" key={index} delay={index * 0.05}>
                <span className={`value-icon value-icon-${index}`}>
                  <item.icon size={21} />
                </span>
                <div>
                  <h3>{(ar ? item.ar : item.en)[0]}</h3>
                  <p>{(ar ? item.ar : item.en)[1]}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section projects-section container">
        <Reveal>
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                <span className="status-dot lavender-dot" />
                {text('home.projectsEyebrow', ar ? 'القادم إلى الأفق' : 'NEXT ON THE HORIZON')}
              </p>
              <h2>
                {text('home.projectsTitle1', ar ? 'رؤية اليوم.' : 'Today’s vision.')}
                <br />
                <em>{text('home.projectsTitle2', ar ? 'عنوان الغد.' : 'Tomorrow’s address.')}</em>
              </h2>
            </div>
            <Link className="button button-outline" href={`/${locale}/projects`}>
              {ar ? 'استكشف المشاريع' : 'Discover new developments'}
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </Reveal>
        <div className="projects-home-grid">
          {projects.map((project, index) => (
            <Reveal key={project.id} delay={index * 0.1}>
              <Link
                className={`project-tile project-tone-${index}`}
                href={`/${locale}/projects/${project.slug}`}
              >
                <div className="project-tile-image">
                  <img
                    src={mediaUrl(project.media[0]?.url)}
                    alt={localized(project, 'name', locale)}
                    loading="lazy"
                  />
                  <span className="project-badge">{ar ? 'قيد الإنشاء' : 'A NEW PERSPECTIVE'}</span>
                  <span className="project-arrow">
                    <ArrowUpRight size={24} />
                  </span>
                </div>
                <div className="project-tile-copy">
                  <p className="eyebrow">{localized(project.area, 'name', locale)}</p>
                  <h3>{localized(project, 'name', locale)}</h3>
                  <p>
                    {ar ? 'يبدأ من' : 'Starting from'}{' '}
                    <strong>{formatMoney(project.startingPriceAed, locale)}</strong>
                  </p>
                  <div className="project-tile-bottom">
                    <span>
                      {project.minBedrooms}—{project.maxBedrooms} {ar ? 'غرف نوم' : 'bedrooms'}
                    </span>
                    <span>
                      {project.handoverDate ? new Date(project.handoverDate).getUTCFullYear() : '—'}{' '}
                      <MoveUpRight size={15} />
                    </span>
                  </div>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        {projects.length === 0 && (
          <p className="muted">
            {ar ? 'المشاريع غير متاحة مؤقتاً.' : 'Developments are temporarily unavailable.'}
          </p>
        )}
      </section>

      <section className="neighbourhood-section section">
        <div className="container">
          <Reveal>
            <div className="section-heading">
              <div>
                <p className="eyebrow">
                  {text('home.areasEyebrow', ar ? 'ابحث عن إيقاعك' : 'FIND YOUR RHYTHM')}
                </p>
                <h2>
                  {text('home.areasTitle1', ar ? 'ليس مجرد مكان.' : 'Not just where.')}
                  <br />
                  <em>{text('home.areasTitle2', ar ? 'طريقة للحياة.' : 'How you live.')}</em>
                </h2>
              </div>
              <p className="section-heading-aside">
                {text(
                  'home.areasDescription',
                  ar
                    ? 'صباح على الواجهة المائية، أو هدوء حديقة، أو طاقة المدينة. أي إيقاع يشبهك؟'
                    : 'Waterfront mornings. Garden-side quiet. The energy of a city. Where do you feel most like you?',
                )}
              </p>
            </div>
          </Reveal>
          <div className="neighbourhood-grid">
            {areas.map((area, index) => (
              <Reveal key={area.id} delay={index * 0.12}>
                <Link
                  className={`neighbourhood-card neighbourhood-${index}`}
                  href={`/${locale}/properties?areaIds=${area.id}`}
                >
                  <img
                    src={`/images/property-0${[2, 6, 7][index]}.webp`}
                    alt={ar ? 'صورة توضيحية لأسلوب الحياة' : 'Illustrative lifestyle photography'}
                    loading="lazy"
                  />
                  <div className="neighbourhood-overlay">
                    <span>
                      {emirateNames[area.emirate]?.[ar ? 1 : 0] ??
                        area.emirate.replaceAll('_', ' ')}
                    </span>
                    <div>
                      <h3>{localized(area, 'name', locale)}</h3>
                      <i>
                        <ArrowUpRight size={22} />
                      </i>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section investment-section container">
        <div className="investment-panel">
          <Reveal className="investment-copy">
            <p className="eyebrow">
              <span className="status-dot" />
              {text(
                'home.investEyebrow',
                ar ? 'استثمر برؤية أوضح' : 'A CLEARER VIEW OF YOUR FUTURE',
              )}
            </p>
            <h2>
              {text('home.investTitle1', ar ? 'أحلام كبيرة.' : 'Big dreams.')}
              <br />
              <em>{text('home.investTitle2', ar ? 'تفكير مدروس.' : 'Clear thinking.')}</em>
            </h2>
            <p>
              {text(
                'home.investDescription',
                ar
                  ? 'قبل اتخاذ الخطوة، افهم الصورة. استكشف تقديرات التمويل وعائد الإيجار وحدد الأسئلة التي تستحق أن تطرحها.'
                  : 'Before the next move, see the bigger picture. Explore mortgage estimates, understand rental yield, and put your possibilities into perspective.',
              )}
            </p>
            <Link href={`/${locale}/invest`} className="button button-primary">
              {ar ? 'استكشف الأرقام' : 'Make room for possibility'}
              <ArrowUpRight size={18} />
            </Link>
            <span className="investment-disclaimer">
              {ar
                ? 'أدوات تقديرية للتخطيط، وليست نصيحة مالية.'
                : 'Planning tools, not financial advice. Your assumptions, your perspective.'}
            </span>
          </Reveal>
          <div className="investment-art" aria-hidden="true">
            <span className="investment-orbit orbit-one" />
            <span className="investment-orbit orbit-two" />
            <div className="sculpture-stack">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="art-sphere art-sphere-one" />
            <div className="art-sphere art-sphere-two" />
            <div className="art-label">
              <Layers3 size={19} />
              <span>
                BUILD A BETTER
                <br />
                PERSPECTIVE
              </span>
            </div>
          </div>
        </div>
      </section>

      <InsightsPreview locale={locale} />
      <section className="section faq-section container">
        <Reveal>
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {text('home.faqEyebrow', ar ? 'لنوضح الصورة' : 'LET’S MAKE THINGS CLEAR')}
              </p>
              <h2>
                {text('home.faqTitle1', ar ? 'أسئلة جيدة.' : 'Good questions.')}
                <br />
                <em>{text('home.faqTitle2', ar ? 'خطوات أوضح.' : 'A clearer next step.')}</em>
              </h2>
            </div>
            <Link href={`/${locale}/contact`} className="text-link">
              {ar ? 'لديك سؤال آخر؟' : 'Something else on your mind?'}
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </Reveal>
        <Faq locale={locale} />
      </section>
      <section className="closing-section">
        <div className="container">
          <Reveal>
            <p className="eyebrow">
              {text(
                'home.ctaEyebrow',
                ar ? 'كل حكاية تحتاج إلى بداية' : 'EVERY STORY NEEDS A STARTING POINT',
              )}
            </p>
            <h2>
              {text('home.ctaTitle1', ar ? 'لنجد مكانك' : 'Let’s find your')}
              <br />
              <em>{text('home.ctaTitle2', ar ? 'في الحكاية.' : 'place in the story.')}</em>
            </h2>
            <Link className="button button-dark" href={`/${locale}/properties`}>
              {ar ? 'فصلك التالي يبدأ هنا' : 'Your next chapter starts here'}
              <ArrowUpRight size={19} />
            </Link>
          </Reveal>
          <ArrowDownRight className="closing-arrow" size={90} strokeWidth={0.7} />
        </div>
      </section>
    </>
  );
}
