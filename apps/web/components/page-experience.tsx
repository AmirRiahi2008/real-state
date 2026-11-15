'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { ArrowUpRight } from 'lucide-react';
import type { Locale } from '@/lib/api';
import './page-experience.css';

/** The opening cover follows fonts and the first rendered hero frame, with a fail-open deadline. */
export function ExperienceLoader({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const overlay = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [present, setPresent] = useState(true);
  const ar = locale === 'ar';

  useEffect(() => {
    let cancelled = false;
    let fontsReady = false;
    const isHome = /^\/(en|ar)\/?$/.test(pathname);
    const needsHero = isHome && (!window.location.hash || window.location.hash === '#story');
    let observer: MutationObserver | undefined;
    let deadline = 0;
    const finish = () => {
      if (cancelled) return;
      observer?.disconnect();
      clearTimeout(deadline);
      setReady(true);
    };
    deadline = window.setTimeout(finish, 8000);
    const check = () => {
      if (cancelled || !fontsReady) return;
      if (!needsHero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finish();
        return;
      }
      const scene = document.querySelector<HTMLElement>('[data-scene-stage]');
      const bounds = scene?.getBoundingClientRect();
      if (bounds && bounds.height > 0 && (bounds.bottom <= 0 || bounds.top >= window.innerHeight)) {
        finish();
        return;
      }
      if (
        scene?.dataset.webglFallback === 'true' ||
        scene?.dataset.sceneReady === 'true' ||
        (scene?.querySelector('canvas') && Number(scene.dataset.drawCalls) > 0)
      )
        finish();
    };
    observer = new MutationObserver(check);
    const main = document.getElementById('main');
    if (main)
      observer.observe(main, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-draw-calls', 'data-webgl-fallback', 'data-scene-ready'],
      });
    void document.fonts.ready.then(() => {
      fontsReady = true;
      requestAnimationFrame(check);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      clearTimeout(deadline);
    };
    // This cover belongs to the initial document, not subsequent client navigations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!present || !overlay.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        '.experience-loader-floor',
        { y: 22, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          stagger: { each: 0.065, from: 'end' },
          duration: 0.65,
          ease: 'power3.out',
        },
      );
      gsap.fromTo(
        '.experience-loader-orbit',
        { rotation: -25 },
        {
          rotation: 335,
          duration: 18,
          ease: 'none',
          repeat: -1,
        },
      );
    }, overlay);
    return () => context.revert();
  }, [present]);

  useEffect(() => {
    if (!ready || !present || !overlay.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPresent(false);
      return;
    }
    const element = overlay.current;
    const timeline = gsap.timeline({ onComplete: () => setPresent(false) });
    timeline
      .to(element.querySelector('.experience-loader-centre'), {
        opacity: 0,
        y: -14,
        duration: 0.25,
        ease: 'power2.in',
      })
      .to(
        element.querySelectorAll('.experience-loader-curtain'),
        {
          scaleY: 0,
          transformOrigin: 'top',
          duration: 0.7,
          stagger: 0.07,
          ease: 'power4.inOut',
        },
        0.12,
      );
    return () => {
      timeline.kill();
    };
  }, [ready, present]);

  if (!present) return null;
  return (
    <div
      ref={overlay}
      className="experience-loader"
      data-testid="page-loader"
      data-state={ready ? 'leaving' : 'preparing'}
    >
      <div className="experience-loader-curtain" />
      <div className="experience-loader-curtain" />
      <div className="experience-loader-curtain" />
      <div className="experience-loader-topline" aria-hidden="true">
        <span>ORIVA · UAE</span>
        <span>{ar ? 'من الفكرة إلى الحياة' : 'FROM POSSIBILITY TO PLACE'}</span>
      </div>
      <button type="button" className="experience-loader-skip" onClick={() => setReady(true)}>
        {ar ? 'انتقل إلى الموقع' : 'Enter the experience'} <ArrowUpRight size={15} />
      </button>
      <div className="experience-loader-centre">
        <div className="experience-loader-sculpture" aria-hidden="true">
          <div className="experience-loader-orbit" />
          <div className="experience-loader-tower">
            {Array.from({ length: 8 }, (_, index) => (
              <i
                key={index}
                className="experience-loader-floor"
                style={{ bottom: `${index * 17}px` }}
              >
                <b />
                <b />
                <b />
                <b />
              </i>
            ))}
          </div>
          <span className="experience-loader-shadow" />
        </div>
        <p className="experience-loader-wordmark" aria-hidden="true">
          oriva<span>®</span>
        </p>
        <div className="experience-loader-status" role="status" aria-live="polite">
          <span />
          {ar ? 'نُحضّر لك منظوراً جديداً.' : 'A new perspective is taking shape.'}
        </div>
        <span className="experience-loader-line" aria-hidden="true">
          <i />
        </span>
      </div>
    </div>
  );
}

/** Animate new page headings without remounting forms or transforming sticky scene ancestors. */
export function PageEntry({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!surface.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let animated = false;
    let tween: gsap.core.Tween | undefined;
    let target: HTMLElement | null = null;
    let observer: MutationObserver | undefined;
    const run = () => {
      if (animated || !surface.current) return;
      const heading = surface.current.querySelector<HTMLElement>(
        'h1:not(.cinematic-sr-only), .cinematic-caption-position',
      );
      if (!heading) return;
      animated = true;
      target = heading;
      observer?.disconnect();
      tween = gsap.fromTo(
        heading,
        { autoAlpha: 0.35, y: 23 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.75,
          ease: 'power3.out',
          clearProps: 'opacity,visibility,transform',
        },
      );
    };
    run();
    observer = new MutationObserver(run);
    if (!animated) observer.observe(surface.current, { subtree: true, childList: true });
    return () => {
      observer?.disconnect();
      tween?.kill();
      if (target) gsap.set(target, { clearProps: 'opacity,visibility,transform' });
    };
  }, [pathname]);
  return (
    <div className="page-entry-surface" ref={surface} data-page-path={pathname}>
      {children}
    </div>
  );
}

export function RouteLoading() {
  const pathname = usePathname();
  const ar = pathname.startsWith('/ar');
  return (
    <section className="route-loading container" role="status" aria-live="polite">
      <div className="route-loading-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <p className="eyebrow">ORIVA</p>
      <h2>{ar ? 'مساحة جديدة، في الطريق.' : 'Another perspective, on its way.'}</h2>
      <p>{ar ? 'نحضّر تفاصيل صفحتك…' : 'Preparing the details of your next page…'}</p>
      <div className="route-loading-skeleton" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </section>
  );
}
