'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Locale } from '@/lib/api';
import './uae-flag.css';
import { useSiteText } from './site-content-provider';

const FlagScene = dynamic(() => import('./uae-flag-scene'), {
  ssr: false,
  loading: () => <FlagPlaceholder />,
});

function FlagPlaceholder() {
  return (
    <div className="uae-flag-placeholder" aria-hidden="true">
      <i />
      <span>
        <b />
        <em>
          <i />
          <i />
          <i />
        </em>
      </span>
    </div>
  );
}

/** A generous, independent display keeps the national flag clear of brand marks and sales controls. */
export default function UaeFlagSection({ locale }: { locale: Locale }) {
  const root = useRef<HTMLElement>(null);
  const [warm, setWarm] = useState(false);
  const reduced = useReducedMotion();
  const ar = locale === 'ar';
  const text = useSiteText(locale);
  useEffect(() => {
    if (!root.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setWarm(true);
          observer.disconnect();
        }
      },
      { rootMargin: '450px' },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  return (
    <section className="uae-section" id="emirates" ref={root} aria-labelledby="uae-heading">
      <div className="container uae-section-heading">
        <motion.div
          initial={false}
          whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <p className="eyebrow">
            <span className="uae-colour-mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            {text('flag.eyebrow', ar ? 'من هنا، نرى أبعد' : 'FROM HERE, WE SEE FURTHER')}
          </p>
          <h2 id="uae-heading">
            {text('flag.title1', ar ? 'سبع إمارات.' : 'Seven emirates.')}
            <br />
            <em>{text('flag.title2', ar ? 'وأفق يجمعنا.' : 'One shared horizon.')}</em>
          </h2>
        </motion.div>
        <div className="uae-section-aside">
          <span className="uae-outline-mark" aria-hidden="true">
            AE
          </span>
          <p>
            {text(
              'flag.description',
              ar
                ? 'مكانٌ تتحوّل فيه الطموحات إلى إمكانات، ويكتب الناس فيه فصولهم القادمة. الإمارات، بروحها وأفقها، تلهم منظورنا للحياة.'
                : 'A place where ambition becomes possibility, and people make their next chapter their own. The Emirates, in spirit and in outlook, inspire our perspective on living.',
            )}
          </p>
        </div>
      </div>
      <div
        className="uae-flag-stage"
        aria-label={
          ar
            ? 'علم دولة الإمارات العربية المتحدة يرفرف على سارية'
            : 'The national flag of the United Arab Emirates, flying from its flagpole'
        }
      >
        <div className="uae-flag-aura" aria-hidden="true" />
        {warm ? <FlagScene locale={locale} /> : <FlagPlaceholder />}
        <div className="uae-stage-caption" aria-hidden="true">
          <span>{ar ? 'الإمارات العربية المتحدة' : 'UNITED ARAB EMIRATES'}</span>
          <i />
          <span>
            {text(
              'flag.caption',
              ar ? 'روح واحدة. إمكانات بلا حدود.' : 'ONE SPIRIT. ENDLESS POSSIBILITY.',
            )}
          </span>
        </div>
      </div>
      <div
        className="container uae-emirates-line"
        aria-label={ar ? 'الإمارات السبع' : 'The seven emirates'}
      >
        {(ar
          ? ['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'أم القيوين', 'رأس الخيمة', 'الفجيرة']
          : [
              'Abu Dhabi',
              'Dubai',
              'Sharjah',
              'Ajman',
              'Umm Al Quwain',
              'Ras Al Khaimah',
              'Fujairah',
            ]
        ).map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
    </section>
  );
}
