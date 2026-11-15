'use client';

import { LockKeyhole, MessageCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { Locale } from '@/lib/api';
import type { TeamMember } from '@/lib/team-types';
import MemberAvatar from './member-avatar';

export default function QaConversationArt({
  locale,
  members,
  note,
}: {
  locale: Locale;
  members: TeamMember[];
  note: string;
}) {
  const ar = locale === 'ar';
  const reduced = useReducedMotion();
  return (
    <div className="qa-concierge-art">
      <span className="qa-concierge-floor" aria-hidden="true" />
      <div className="qa-concierge-window" aria-hidden="true">
        <svg className="qa-concierge-city" viewBox="0 0 380 480" fill="none">
          <circle className="qa-city-sun" cx="284" cy="134" r="43" />
          <path className="qa-city-horizon" d="M0 296C86 277 234 296 380 267V480H0Z" />
          <g className="qa-city-distant">
            <path d="M0 327V268H30V327M40 327V240H65V327M76 327V274H109V327M270 327V249H299V327M310 327V224H333V327M346 327V261H380V327" />
            <path d="M45 240V229H61V240M316 224V209H327V224M85 274V261H101V274" />
          </g>
          <g className="qa-city-buildings">
            <path d="M21 382V281L57 268V382ZM71 382V302H107V382ZM123 382V244L150 228L165 244V382ZM246 382V259L271 244L295 259V382ZM309 382V283L344 266V382Z" />
            <path
              className="qa-city-building-side"
              d="M57 268L68 284V382H57ZM150 228L165 244V382H150ZM271 244L295 259V382H271ZM344 266L357 282V382H344Z"
            />
          </g>
          <path
            className="qa-city-burj"
            d="M174 389V313H180V267H184V226H188V186H192V157H196V125H199V96H201V63H203V96H205V125H208V157H212V186H216V226H220V267H224V313H230V389Z"
          />
          <path
            className="qa-city-burj-side"
            d="M203 96H205V125H208V157H212V186H216V226H220V267H224V313H230V389H203Z"
          />
          <g className="qa-city-windows">
            <path d="M29 290H48M29 302H48M29 314H48M29 326H48M29 338H48M29 350H48M79 313H99M79 325H99M79 337H99M79 349H99M132 255H145M132 267H145M132 279H145M132 291H145M132 303H145M132 315H145M132 327H145M132 339H145M254 273H265M254 285H265M254 297H265M254 309H265M254 321H265M254 333H265M318 294H337M318 306H337M318 318H337M318 330H337M318 342H337" />
            <path d="M195 174H210M191 202H214M188 239H218M184 280H222M180 324H227M179 336H228M179 348H228M179 360H228M179 372H228" />
          </g>
          <path className="qa-city-water" d="M0 384H380V480H0Z" />
          <g className="qa-city-water-lines">
            <path d="M0 405H380M0 431H380M0 465H380M190 384L41 480M190 384L128 480M190 384L252 480M190 384L339 480" />
          </g>
        </svg>
        <span className="qa-concierge-mullion" />
        <span className="qa-concierge-sill" />
      </div>
      <span className="qa-concierge-drawing-label" aria-hidden="true">
        ORIVA · DUBAI
      </span>
      <motion.div
        className="qa-concierge-panel"
        initial={reduced ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.7, delay: reduced ? 0 : 0.3 }}
      >
        <div className="qa-concierge-privacy">
          <LockKeyhole size={12} aria-hidden="true" />
          <span>{ar ? 'محادثات خاصة' : 'Private conversations'}</span>
        </div>
        <p className="qa-concierge-note">{note}</p>
        <div className="qa-concierge-panel-bottom">
          {members.length ? (
            <div className="qa-concierge-people">
              {members.slice(0, 3).map((member) => (
                <MemberAvatar key={member.id} member={member} />
              ))}
            </div>
          ) : (
            <span className="qa-concierge-message-icon" aria-hidden="true">
              <MessageCircle size={20} />
            </span>
          )}
          <p>
            <span>{ar ? 'فريق أوريفا' : 'The ORIVA team'}</span>
            <span lang="en" dir="ltr">
              English · العربية
            </span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
