'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowUpRight, ChevronsDown, Pause } from 'lucide-react';
import type { Locale } from '@/lib/api';
import './scroll-story.css';

const BuildingScene = dynamic(() => import('./building-scene'), {
  ssr: false,
  loading: () => (
    <div className="cinematic-loader">
      <span />
      <p>ORIVA</p>
    </div>
  ),
});
const chapters = [
  {
    threshold: 0,
    align: 'left',
    accent: 'mint',
    en: [
      'THE FIRST SPARK',
      'A single idea.',
      'A whole new world.',
      'Before the skyline, a person imagines more. Follow a first ambition as it becomes a place to call your own.',
    ],
    ar: [
      'الشرارة الأولى',
      'فكرة واحدة.',
      'وعالمٌ جديد.',
      'قبل أن يرتفع الأفق، يتخيّل إنسانٌ ما هو أبعد. تابع الطموح الأول وهو يتحوّل إلى مكان تنتمي إليه.',
    ],
  },
  {
    threshold: 0.12,
    align: 'left',
    accent: 'sand',
    en: [
      '01 / THE GROUNDWORK',
      'Big dreams.',
      'Solid foundations.',
      'The ground is prepared. Reinforcement finds its place. Every meaningful beginning needs something strong beneath it.',
    ],
    ar: [
      '٠١ / الأساسات',
      'أحلام كبيرة.',
      'وأساسات راسخة.',
      'تُجهّز الأرض ويأخذ الحديد مكانه. كل بداية تستحق أن تحملها قاعدة متينة.',
    ],
  },
  {
    threshold: 0.28,
    align: 'right',
    accent: 'peach',
    en: [
      '02 / THE STRUCTURE',
      'Strength,',
      'taking shape.',
      'Columns rise. Beams connect. The quiet precision of a team turns a drawing into something you can stand beneath.',
    ],
    ar: [
      '٠٢ / الهيكل',
      'القوة،',
      'تأخذ شكلها.',
      'ترتفع الأعمدة وتتصل الجسور. بدقّة فريق متكامل، يتحوّل الرسم إلى بناء حقيقي.',
    ],
  },
  {
    threshold: 0.47,
    align: 'left',
    accent: 'lavender',
    en: [
      '03 / FLOOR BY FLOOR',
      'One layer.',
      'More possibility.',
      'A crane lifts. A floor settles. The next one follows. With each level, a little more room for the life ahead.',
    ],
    ar: [
      '٠٣ / طابق بعد طابق',
      'طبقة جديدة.',
      'وإمكانات أوسع.',
      'ترفع الرافعة، ويستقر طابق، ثم يأتي الذي يليه. مع كل مستوى، تتّسع مساحة الحياة القادمة.',
    ],
  },
  {
    threshold: 0.63,
    align: 'left',
    accent: 'blue',
    en: [
      '04 / THE FINISHING TOUCHES',
      'Let the light',
      'find its way.',
      'Glass meets stone. Balconies open to the air. Small, considered details give the structure its own character.',
    ],
    ar: [
      '٠٤ / اللمسات الأخيرة',
      'دع الضوء',
      'يجد طريقه.',
      'يلتقي الزجاج بالحجر، وتنفتح الشرفات على الهواء. تمنح التفاصيل المدروسة المبنى شخصيته.',
    ],
  },
  {
    threshold: 0.79,
    align: 'right',
    accent: 'mint',
    en: [
      '05 / A LIFE WITHIN',
      'A building.',
      'Then, a belonging.',
      'The cranes step back. Gardens grow. Warm windows and familiar faces bring the architecture to life.',
    ],
    ar: [
      '٠٥ / الحياة في الداخل',
      'كان مبنى.',
      'فأصبح انتماءً.',
      'تتراجع الرافعات وتكتمل الحدائق. نوافذ دافئة ووجوه مألوفة تمنح العمارة روحها.',
    ],
  },
  {
    threshold: 0.92,
    align: 'left',
    accent: 'peach',
    en: [
      '06 / YOUR NEXT CHAPTER',
      'A place to live.',
      'A future to shape.',
      'From the first idea to the final key. Explore a home to belong to, and an investment to understand. Your next chapter starts here.',
    ],
    ar: [
      '٠٦ / فصلك التالي',
      'مكان للحياة.',
      'ومستقبل تصنعه.',
      'من أول فكرة إلى آخر مفتاح. اكتشف منزلاً تنتمي إليه واستثماراً تفهمه. فصلك التالي يبدأ هنا.',
    ],
  },
] as const;

export default function ScrollStory({ locale }: { locale: Locale }) {
  const root = useRef<HTMLElement>(null);
  const progress = useRef({ value: 0 });
  const [chapter, setChapter] = useState(0);
  const [percent, setPercent] = useState(0);
  const deviceReducedMotion = useReducedMotion();
  // Match the server's first render; the browser preference is applied after hydration.
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(Boolean(deviceReducedMotion)), [deviceReducedMotion]);
  const ar = locale === 'ar';
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (reduced) {
      progress.current.value = 1;
      setChapter(chapters.length - 1);
      setPercent(100);
      return;
    }
    progress.current.value = 0;
    setChapter(0);
    setPercent(0);
    const context = gsap.context(() => {
      gsap.to(progress.current, {
        value: 1,
        ease: 'none',
        onUpdate: () => {
          const value = progress.current.value;
          setPercent(Math.round(value * 100));
          let next = 0;
          chapters.forEach((item, index) => {
            if (value >= item.threshold) next = index;
          });
          setChapter(next);
        },
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.9,
          invalidateOnRefresh: true,
        },
      });
    }, root);
    return () => {
      context.revert();
      progress.current.value = 0;
    };
  }, [reduced]);
  const active = chapters[chapter] ?? chapters[0];
  const [label, firstLine, secondLine, description] = ar ? active.ar : active.en;
  return (
    <section
      id="story"
      ref={root}
      className={`cinematic-story${reduced ? ' cinematic-reduced' : ''}`}
      data-story-progress={percent}
      data-target-scroll-seconds="30"
      aria-label={
        ar
          ? 'من الفكرة إلى الحياة — حكاية بناء ثلاثية الأبعاد'
          : 'From a first idea to a place of your own — a construction story'
      }
    >
      <h1 className="cinematic-sr-only">
        {ar
          ? 'أوريفا — من أول فكرة إلى مكان تنتمي إليه'
          : 'ORIVA — From a single idea to a place to belong'}
      </h1>
      <div className="cinematic-viewport">
        <div className="cinematic-atmosphere" aria-hidden="true">
          <span className="cinematic-sun" />
          <span className="cinematic-horizon" />
        </div>
        <div className="cinematic-model">
          <BuildingScene locale={locale} progress={progress} />
        </div>
        <div
          className={`cinematic-text-scrim cinematic-scrim-${active.align}`}
          aria-hidden="true"
        />
        <div className="cinematic-topline">
          <span>
            <i />
            {ar ? 'منظور جديد للحياة' : 'A NEW PERSPECTIVE ON LIVING'}
          </span>
          <span className="cinematic-edition">ORIVA · UAE</span>
        </div>
        <div
          className="cinematic-caption-position"
          data-align={active.align}
          aria-live="polite"
          aria-atomic="true"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${locale}-${chapter}`}
              className={`cinematic-caption cinematic-accent-${active.accent}`}
              initial={reduced ? false : { opacity: 0, y: 28, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduced ? undefined : { opacity: 0, y: -22, filter: 'blur(7px)' }}
              transition={{ duration: reduced ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="cinematic-kicker">
                <span />
                {label}
              </p>
              <h2>
                {firstLine}
                <br />
                <em>{secondLine}</em>
              </h2>
              <p className="cinematic-description">{description}</p>
              {chapter === 0 ? (
                <div className="cinematic-intro-hint">
                  <span>
                    <ArrowDown size={17} />
                  </span>
                  <p>{ar ? 'مرّر لتبني الحكاية.' : 'Scroll. Watch possibility become a place.'}</p>
                </div>
              ) : null}
              {chapter === chapters.length - 1 ? (
                <div className="cinematic-final-actions">
                  <Link className="button button-primary" href={`/${locale}/properties`}>
                    {ar ? 'اكتشف مساحتك' : 'Find your space'}
                    <ArrowUpRight size={17} />
                  </Link>
                  <a href="#discover" className="cinematic-collection-link">
                    {ar ? 'استكشف المجموعة' : 'Explore the collection'}
                    <ArrowDown size={15} />
                  </a>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="cinematic-stage-index" aria-hidden="true">
          <span>{String(chapter + 1).padStart(2, '0')}</span>
          <i />
          07
        </div>
        <div className="cinematic-bottomline">
          <div className="cinematic-build-status">
            <span className="cinematic-percent">
              {String(percent).padStart(2, '0')}
              <small>%</small>
            </span>
            <div>
              <span>{ar ? 'حلمٌ قيد البناء' : 'A VISION IN THE MAKING'}</span>
              <p>
                {ar
                  ? 'تصوّر معماري · ليس عقاراً معروضاً للبيع'
                  : 'An architectural concept. A world of possibility.'}
              </p>
            </div>
          </div>
          <div
            className="cinematic-local-progress"
            data-testid="construction-progress"
            role="progressbar"
            aria-label={ar ? 'تقدّم البناء' : 'Construction progress'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent}%`}
          >
            <div>
              <span style={{ transform: `scaleX(${percent / 100})` }} />
            </div>
            <ol aria-hidden="true">
              {['01', '02', '03', '04', '05', '06', '07'].map((step, index) => (
                <li key={step} className={chapter >= index ? 'is-built' : ''}>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <a href="#story-end" className="cinematic-skip">
            {ar ? 'انتقل إلى المجموعة' : 'Skip to the collection'}
            <ChevronsDown size={15} />
          </a>
        </div>
        {reduced ? (
          <span className="cinematic-motion-note">
            <Pause size={11} />
            {ar ? 'حركة مخفّضة حسب تفضيل جهازك' : 'Reduced motion follows your device preference'}
          </span>
        ) : null}
      </div>
      <div className={reduced ? 'cinematic-reduced-chapters container' : 'cinematic-sr-only'}>
        {chapters.map((item, index) => {
          const copy = ar ? item.ar : item.en;
          return (
            <article className="story-chapter" id={`chapter-${index + 1}`} key={copy[0]}>
              <p>{copy[0]}</p>
              <h3>
                {copy[1]} {copy[2]}
              </h3>
              <p>{copy[3]}</p>
            </article>
          );
        })}
      </div>
      <div id="story-end" className="cinematic-end" aria-hidden="true" />
    </section>
  );
}
