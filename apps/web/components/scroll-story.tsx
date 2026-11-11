'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUpRight,
  Box,
  Sparkles,
  Layers3,
  MoveUpRight,
  Mouse,
} from 'lucide-react';
import type { Locale } from '@/lib/api';

const BuildingScene = dynamic(() => import('./building-scene'), {
  ssr: false,
  loading: () => (
    <div className="scene-loading">
      <span className="scene-loading-orbit" />
      <span>ORIVA</span>
    </div>
  ),
});
const chapters = [
  {
    en: [
      'THE SPARK',
      'First, a little\nwonder.',
      'Before the blueprints, before the skyline, there is a person looking ahead. A first ambition. A growing family. A different way to live.',
      'Every remarkable place begins with someone imagining more.',
    ],
    ar: [
      'الشرارة الأولى',
      'في البداية،\nقليل من الدهشة.',
      'قبل المخططات وقبل الأفق، هناك إنسان يتطلع إلى الغد. طموح أول، وعائلة تكبر، وطريقة مختلفة للحياة.',
      'كل مكان استثنائي يبدأ بشخص يتخيل ما هو أبعد.',
    ],
    accent: 'peach',
    icon: Sparkles,
  },
  {
    en: [
      'THE FOUNDATION',
      'Give your idea\nsolid ground.',
      'An ambition becomes a plan. Explore a neighbourhood, understand its rhythm, and find the ground that fits the life you want to build.',
      'Location is more than a pin. It is the beginning of belonging.',
    ],
    ar: [
      'الأساس',
      'امنح فكرتك\nأرضاً ثابتة.',
      'يتحول الطموح إلى خطة. اكتشف الحي وإيقاعه، وابحث عن المكان الذي يلائم الحياة التي تريد بناءها.',
      'الموقع ليس مجرد نقطة على الخريطة؛ إنه بداية الانتماء.',
    ],
    accent: 'mint',
    icon: Box,
  },
  {
    en: [
      'THE STRUCTURE',
      'One layer.\nMore possibility.',
      'The framework rises, floor by floor. Thoughtful proportions, honest materials, and room for the everyday moments that make a home yours.',
      'Scroll a little further. Watch possibility take shape.',
    ],
    ar: [
      'الهيكل',
      'طبقة تلو أخرى.\nوإمكانات أكبر.',
      'يرتفع البناء طابقاً بعد طابق. تناسب مدروس ومواد مختارة ومساحة للحظات اليومية التي تجعل البيت بيتك.',
      'واصل التمرير، وشاهد الإمكانات وهي تتشكل.',
    ],
    accent: 'lavender',
    icon: Layers3,
  },
  {
    en: [
      'THE LIFE WITHIN',
      'A building becomes\nyour world.',
      'Morning light across the balcony. A shared dinner. A quiet corner to think. The details turn square metres into something far more personal.',
      'Choose a place for how it feels, as well as what it holds.',
    ],
    ar: [
      'الحياة في الداخل',
      'يصبح المبنى\nعالمك الخاص.',
      'ضوء الصباح على الشرفة، وعشاء يجمع العائلة، وركن هادئ للتفكير. تحوّل التفاصيل الأمتار المربعة إلى شيء أعمق وأكثر خصوصية.',
      'اختر المكان لإحساسه، كما تختاره لمساحته.',
    ],
    accent: 'blue',
    icon: Sparkles,
  },
  {
    en: [
      'THE NEXT CHAPTER',
      'Live today.\nThink beyond.',
      'A home can be a place to belong and an asset to understand. Explore the numbers, compare possibilities, and invest with a clear view of the future.',
      'Your story keeps growing. Your space should, too.',
    ],
    ar: [
      'الفصل التالي',
      'عش اليوم.\nوفكّر في الغد.',
      'يمكن للمنزل أن يكون مكاناً للانتماء وأصلاً تفهم قيمته. استكشف الأرقام وقارن الخيارات واستثمر برؤية واضحة للمستقبل.',
      'حكايتك تواصل النمو، ومساحتك كذلك.',
    ],
    accent: 'peach',
    icon: MoveUpRight,
  },
];

export default function ScrollStory({ locale }: { locale: Locale }) {
  const root = useRef<HTMLElement>(null);
  const [chapter, setChapter] = useState(0);
  const reduced = useReducedMotion();
  const ar = locale === 'ar';
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      const entries = gsap.utils.toArray<HTMLElement>('.story-chapter');
      entries.forEach((element, index) => {
        ScrollTrigger.create({
          trigger: element,
          start: 'top 65%',
          end: 'bottom 35%',
          onEnter: () => setChapter(index + 1),
          onEnterBack: () => setChapter(index + 1),
        });
        if (!reduced)
          gsap.fromTo(
            element.querySelector('.chapter-inner'),
            { opacity: 0.18, y: 55 },
            {
              opacity: 1,
              y: 0,
              ease: 'none',
              scrollTrigger: { trigger: element, start: 'top 85%', end: 'top 40%', scrub: true },
            },
          );
      });
      ScrollTrigger.create({
        trigger: '.hero-copy',
        start: 'top top',
        end: 'bottom 65%',
        onEnterBack: () => setChapter(0),
      });
    }, root);
    return () => context.revert();
  }, [reduced]);
  return (
    <section
      id="story"
      ref={root}
      className="scroll-story"
      aria-label={
        ar
          ? 'من الحلم إلى الاستثمار — حكاية ثلاثية الأبعاد'
          : 'From a first spark to a place of your own — a 3D story'
      }
    >
      <div className="story-layout container">
        <div className="story-copy">
          <div className="hero-copy">
            <motion.div
              className="eyebrow hero-eyebrow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <span className="status-dot" />
              {ar ? 'منظور جديد للحياة في الإمارات' : 'A NEW PERSPECTIVE ON UAE LIVING'}
            </motion.div>
            <motion.h1
              initial={reduced ? false : { opacity: 0, y: 35 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1 }}
            >
              {ar ? (
                <>
                  الحياة التي
                  <br />
                  تتخيلها.
                  <br />
                  <em>نمنحها شكلاً.</em>
                </>
              ) : (
                <>
                  A life
                  <br />
                  imagined.
                  <br />
                  <em>A place to be.</em>
                </>
              )}
            </motion.h1>
            <motion.p
              className="hero-description"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              {ar
                ? 'من أول حلم إلى مفتاح بابك. اكتشف العقارات التي تفتح فصلاً جديداً لحياتك في الإمارات.'
                : 'From your first what-if to your very own front door. Discover spaces for the life you’re ready to create.'}
            </motion.p>
            <motion.div
              className="hero-actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <Link href={`/${locale}/properties`} className="button button-primary">
                {ar ? 'اكتشف مساحتك' : 'Find your space'}
                <ArrowUpRight size={18} />
              </Link>
              <a href="#chapter-1" className="text-link">
                {ar ? 'شاهد الحكاية' : 'Explore the story'}
                <ArrowDown size={16} />
              </a>
            </motion.div>
            <div className="hero-footnote">
              <span className="tiny-avatars">
                <i>O</i>
                <i>R</i>
                <i>V</i>
              </span>
              <p>
                {ar ? (
                  <>
                    للأحلام الكبيرة.
                    <br />
                    <strong>وللتفاصيل الصغيرة.</strong>
                  </>
                ) : (
                  <>
                    For the big dreams.
                    <br />
                    <strong>And the little things.</strong>
                  </>
                )}
              </p>
            </div>
            <a href="#chapter-1" className="scroll-cue">
              <span>
                <Mouse size={17} />
              </span>
              {ar ? 'مرّر لتشكّل الحكاية' : 'SCROLL TO BUILD YOUR STORY'}
              <ArrowDownRight size={17} />
            </a>
          </div>
          {chapters.map((item, index) => {
            const [label, title, text, note] = ar ? item.ar : item.en;
            const Icon = item.icon;
            return (
              <article
                id={`chapter-${index + 1}`}
                className={`story-chapter chapter-${item.accent}`}
                key={item.en[0]}
              >
                <div className="chapter-inner">
                  <span className="chapter-number">
                    0{index + 1}
                    <span> / 05</span>
                  </span>
                  <p className="eyebrow">
                    <Icon size={16} />
                    {label}
                  </p>
                  <h2>{title}</h2>
                  <p className="chapter-description">{text}</p>
                  <div className="chapter-note">
                    <span />
                    {note}
                  </div>
                  {index === 4 && (
                    <Link className="button button-dark" href={`/${locale}/invest`}>
                      {ar ? 'استكشف الإمكانات' : 'Explore the possibilities'}
                      <ArrowUpRight size={18} />
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <div className="story-visual">
          <div className="scene-ambient scene-ambient-one" />
          <div className="scene-ambient scene-ambient-two" />
          <div className="scene-coordinate">
            <span>25°12′ N&nbsp;&nbsp; 55°16′ E</span>
            <span>{ar ? 'الإمارات العربية المتحدة' : 'UNITED ARAB EMIRATES'}</span>
          </div>
          <BuildingScene locale={locale} />
          <div className="scene-caption">
            <span className="scene-live">
              <i />
              {ar ? 'تصوّر الإمكانات' : 'IMAGINE THE POSSIBILITIES'}
            </span>
            <span>{ar ? 'تصميم تصوّري ثلاثي الأبعاد' : 'A CONCEPT IN THREE DIMENSIONS'}</span>
          </div>
          <div className="scene-floating-card">
            <span className="floating-card-icon">
              <ArrowUpRight size={23} />
            </span>
            <div>
              <strong>{ar ? 'مساحة لما هو قادم.' : 'Space for what’s next.'}</strong>
              <span>{ar ? 'صُمّمت حولك' : 'Considered. Connected. Yours.'}</span>
            </div>
          </div>
          <div className="story-stepper" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((step) => (
              <span className={chapter === step ? 'active' : ''} key={step} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
