'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowDown, ArrowUpRight, ChevronsDown, Pause } from 'lucide-react';
import type { Locale } from '@/lib/api';
import { useSiteText } from './site-content-provider';
import { CONSTRUCTION_PHASES } from './scene/construction-timeline';
import { burjStoryCopy } from './scene/burj-story-copy';
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
const chapterCopy = burjStoryCopy;

const chapters = CONSTRUCTION_PHASES.map((phase, index) => ({
  ...phase,
  threshold: phase.start,
  ...chapterCopy[index],
}));

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
  const text = useSiteText(locale);
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
  const originalCopy = ar ? active.ar : active.en;
  const [label, firstLine, secondLine, description] = [
    'label',
    'title1',
    'title2',
    'description',
  ].map((key, index) => text(`story.${chapter}.${key}`, originalCopy[index]));
  return (
    <section
      id="story"
      ref={root}
      className={`cinematic-story${reduced ? ' cinematic-reduced' : ''}`}
      data-story-progress={percent}
      data-target-scroll-seconds="60"
      aria-label={
        ar
          ? 'حكاية بناء برج خليفة ثلاثية الأبعاد'
          : 'Burj Khalifa — an immersive construction story'
      }
    >
      <h1 className="cinematic-sr-only">
        {ar
          ? 'أوريفا — برج خليفة، حكاية تُبنى مع التمرير'
          : 'ORIVA — Burj Khalifa, built with your scroll'}
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
            {ar ? 'برج خليفة / من الأرض إلى السماء' : 'BURJ KHALIFA / FROM GROUND TO SKY'}
          </span>
          <span className="cinematic-edition">DUBAI · 828 M</span>
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
              className={`cinematic-caption cinematic-accent-${active.accent}${!ar && Math.max(firstLine.length, secondLine.length) >= 19 ? ' cinematic-caption-compact' : ''}`}
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
                  <p>
                    {ar
                      ? 'حكاية بدقيقة تقريباً. أنت تتحكّم بإيقاعها.'
                      : 'A story in about a minute. Your scroll sets the pace.'}
                  </p>
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
          {String(chapters.length).padStart(2, '0')}
        </div>
        <div className="cinematic-bottomline">
          <div className="cinematic-build-status">
            <span className="cinematic-percent">
              {String(percent).padStart(2, '0')}
              <small>%</small>
            </span>
            <div>
              <span>{ar ? 'حلمٌ قيد البناء' : 'A VISION IN THE MAKING'}</span>
              <p>{ar ? 'حكاية معمارية لبرج خليفة' : 'An architectural tribute to Burj Khalifa.'}</p>
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
              {chapters.map((item, index) => (
                <li key={item.id} className={chapter >= index ? 'is-built' : ''}>
                  {String(index + 1).padStart(2, '0')}
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
          const original = ar ? item.ar : item.en;
          const copy = ['label', 'title1', 'title2', 'description'].map((key, position) =>
            text(`story.${index}.${key}`, original[position]),
          );
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
