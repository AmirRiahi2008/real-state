'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import Reveal from '@/components/reveal';
import type { Locale } from '@/lib/api';
import type { TeamConversation, TeamMember, TeamMessage, TeamPage } from '@/lib/team-types';
import { isAbort, profileUpdateChannel, teamError, teamRequest, TeamApiError } from './team-api';
import MemberAvatar from './member-avatar';
import QaConversationArt from './qa-conversation-art';
import { MessageList } from './message-list';
import { useConversation } from './use-conversation';
import './team.css';
import './qa-directory.css';
import { useSiteText } from '../site-content-provider';

const storageKey = (id: string) => `oriva-team-conversation:${id}`;
function remember(memberId: string, conversationId: string | null) {
  try {
    if (conversationId) localStorage.setItem(storageKey(memberId), conversationId);
    else localStorage.removeItem(storageKey(memberId));
  } catch {
    /* A private conversation still works without persistent browser storage. */
  }
}

export default function QaDirectory({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const text = useSiteText(locale);
  const reduced = useReducedMotion();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selected, setSelected] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const featured = members.find((member) => /^melika(?:-|$)/i.test(member.slug)) ?? members[0];
  const supporting = members.filter((member) => member.id !== featured?.id);
  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let loaded = false;
    let controller: AbortController | null = null;
    setLoading(true);
    async function load(initial = false) {
      if (stopped || inFlight || (!initial && document.hidden)) return;
      inFlight = true;
      controller = new AbortController();
      try {
        const result = await teamRequest<TeamPage<TeamMember>>('/members', {
          signal: controller.signal,
        });
        if (stopped) return;
        loaded = true;
        setMembers(result.data);
        setSelected((previous) =>
          previous ? (result.data.find((member) => member.id === previous.id) ?? null) : null,
        );
        setFailure(null);
      } catch (error) {
        if (!stopped && !loaded && !isAbort(error)) setFailure(error);
      } finally {
        inFlight = false;
        if (!stopped) setLoading(false);
      }
    }
    const refresh = () => {
      void load();
    };
    void load(true);
    const timer = window.setInterval(refresh, 15000);
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(profileUpdateChannel) : null;
    if (channel) channel.onmessage = refresh;
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener(profileUpdateChannel, refresh);
    return () => {
      stopped = true;
      clearInterval(timer);
      controller?.abort();
      channel?.close();
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(profileUpdateChannel, refresh);
    };
  }, [attempt]);
  return (
    <div className="team-page qa-page">
      <section className="container qa-hero">
        <Reveal className="qa-hero-copy">
          <p className="qa-eyebrow">
            <span className="qa-eyebrow-line" aria-hidden="true" />
            {text('qa.eyebrow', ar ? 'الناس خلف أوريفا' : 'THE PEOPLE BEHIND ORIVA')}
          </p>
          <h1>
            <span>{text('qa.title1', ar ? 'كل سؤال.' : 'Every question.')}</span>
            <em>
              {text('qa.title2', ar ? 'يبدأ بإنسان.' : 'A real person.')}
              <svg viewBox="0 0 460 20" preserveAspectRatio="none" aria-hidden="true">
                <motion.path
                  d="M3 14C118 1 299 1 457 10"
                  fill="none"
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.2, delay: 0.65, ease: 'easeOut' }}
                />
              </svg>
            </em>
          </h1>
          <p className="qa-hero-description">
            {text(
              'qa.description',
              ar
                ? 'مرحباً بك في QA. تعرّف إلى فريقنا، اختر من تودّ الحديث معه، وابدأ محادثة خاصة تصل مباشرةً إلى الشخص الذي اخترته.'
                : 'Welcome to QA. Meet the team, choose who you would like to talk to, and start a private conversation with the person behind the name.',
            )}
          </p>
          <a className="qa-discover-link" href="#team-members">
            <span>{text('qa.meetTeam', ar ? 'تعرّف إلى الفريق' : 'Meet your people')}</span>
            <span className="qa-discover-icon">
              <ArrowDown size={17} />
            </span>
          </a>
        </Reveal>
        <Reveal className="qa-hero-art" delay={0.15}>
          <QaConversationArt
            locale={locale}
            members={featured ? [featured, ...supporting] : members}
            note={text(
              'qa.heroNote',
              ar ? 'أسئلة صغيرة. أحاديث لها معنى.' : 'Small questions.\nMeaningful conversations.',
            )}
          />
        </Reveal>
      </section>
      <section
        className="container team-directory qa-directory"
        id="team-members"
        aria-label={ar ? 'فريق أوريفا' : 'The ORIVA team'}
      >
        <Reveal className="qa-directory-heading">
          <div>
            <p className="qa-eyebrow">
              <span className="qa-eyebrow-line" aria-hidden="true" />
              {text(
                'qa.directoryEyebrow',
                ar ? 'فريق واحد، وجهات نظر مختلفة' : 'ONE TEAM. DIFFERENT PERSPECTIVES.',
              )}
            </p>
            <h2>{text('qa.directoryTitle', ar ? 'لنتحدّث.' : 'Let’s talk.')}</h2>
          </div>
          <p>
            {text(
              'qa.directoryDescription',
              ar
                ? 'رسالتك تظهر في صندوق الشخص الذي تختاره فقط. يمكنك العودة لمتابعة الردود من هذا المتصفح.'
                : 'Choose a face. Start a conversation. Your message goes directly to the person you choose.',
            )}
          </p>
        </Reveal>
        {loading ? (
          <div
            className="qa-loading-layout"
            aria-busy="true"
            aria-label={ar ? 'جارٍ تحميل الفريق' : 'Loading the team'}
          >
            {[0, 1, 2].map((index) => (
              <div
                className={`team-card-skeleton qa-loading-card qa-loading-card-${index}`}
                key={index}
              >
                <span />
                <i />
                <i />
              </div>
            ))}
          </div>
        ) : failure ? (
          <div className="team-empty-state" role="alert">
            <MessageCircle size={28} />
            <h3>{ar ? 'نعود للحديث بعد قليل.' : 'A little pause in the conversation.'}</h3>
            <p>{teamError(failure, locale)}</p>
            <button
              className="button button-primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RefreshCw size={16} />
              {ar ? 'حاول مجدداً' : 'Try again'}
            </button>
          </div>
        ) : featured ? (
          <div className="qa-constellation">
            <Reveal className="qa-featured-node">
              <QaMemberCard
                member={featured}
                locale={locale}
                index={0}
                featured
                onMessage={setSelected}
              />
            </Reveal>
            {supporting.length ? (
              <div
                className={`qa-supporting-nodes${supporting.length === 1 ? ' qa-supporting-single' : ''}`}
              >
                <svg
                  className="qa-connection-lines"
                  viewBox="0 0 1200 240"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {(supporting.length === 1
                    ? ['M600 0V112']
                    : [
                        'M600 0V30C600 62 600 62 558 62H280C240 62 240 82 240 112',
                        'M600 0V30C600 62 600 62 642 62H920C960 62 960 82 960 122V232',
                      ]
                  ).map((path, index) => (
                    <g key={path}>
                      <path className="qa-connection-track" d={path} />
                      <motion.path
                        className="qa-connection-draw"
                        d={path}
                        initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                        whileInView={{ pathLength: 1, opacity: 1 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{
                          duration: 1.4,
                          delay: index * 0.22 + 0.15,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                    </g>
                  ))}
                </svg>
                {supporting.map((member, index) => (
                  <Reveal
                    className={`qa-supporting-node qa-supporting-node-${index % 2}`}
                    key={member.id}
                    delay={(index % 2) * 0.14}
                  >
                    <QaMemberCard
                      member={member}
                      locale={locale}
                      index={index + 1}
                      onMessage={setSelected}
                    />
                  </Reveal>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="team-empty-state">
            <h3>{ar ? 'الفريق سيكون هنا قريباً.' : 'The team will be here soon.'}</h3>
          </div>
        )}
      </section>
      <section className="container qa-conversation-note">
        <Reveal className="qa-conversation-note-inner">
          <span className="qa-note-icon">
            <LockKeyhole size={22} />
          </span>
          <div>
            <h2>
              {text(
                'qa.privacyTitle',
                ar ? 'حديثك له مساحته.' : 'A conversation with its own space.',
              )}
            </h2>
            <p>
              {text(
                'qa.privacyDescription',
                ar
                  ? 'تظهر رسائلك وردود الفريق في هذه الصفحة من المتصفح الذي بدأت منه المحادثة. احتفظ بالوصول إلى هذا المتصفح لمتابعة الحديث.'
                  : 'Your messages and the team’s replies stay together here, in the browser where you began. Keep access to this browser to pick up where you left off.',
              )}
            </p>
          </div>
          <Link className="team-inline-link" href={`/${locale}/dashboard/login`}>
            {text('qa.teamSignIn', ar ? 'دخول الفريق' : 'Team sign in')}
            <ArrowUpRight size={16} />
          </Link>
        </Reveal>
      </section>
      {selected ? (
        <GuestChat
          key={selected.id}
          member={selected}
          locale={locale}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function QaMemberCard({
  member,
  locale,
  index,
  featured = false,
  onMessage,
}: {
  member: TeamMember;
  locale: Locale;
  index: number;
  featured?: boolean;
  onMessage: (member: TeamMember) => void;
}) {
  const ar = locale === 'ar';
  const text = useSiteText(locale);
  const reduced = useReducedMotion();
  return (
    <motion.article
      className={`team-person-card qa-member-card${featured ? ' qa-member-featured' : ''}`}
      whileHover={reduced ? undefined : { y: -7 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="qa-member-photo">
        <MemberAvatar member={member} portrait key={member.photoUrl} />
        <span className="qa-photo-corner qa-photo-corner-top" aria-hidden="true" />
        <span className="qa-photo-corner qa-photo-corner-bottom" aria-hidden="true" />
        <span className="qa-member-number" aria-hidden="true">
          {String(index + 1).padStart(2, '0')} / ORIVA
        </span>
      </div>
      <div className="qa-member-copy">
        <p className="qa-member-role">{ar ? member.titleAr || member.titleEn : member.titleEn}</p>
        <h3>{member.displayName}</h3>
        <span className="qa-member-divider" aria-hidden="true" />
        <p className="qa-member-bio">
          {(ar ? member.bioAr || member.bioEn : member.bioEn) ||
            text(
              'qa.memberBioFallback',
              ar
                ? 'مساحة لسؤالك، وشخص يصغي إليك.'
                : 'A place for your question. A person who listens.',
            )}
        </p>
        <button
          className="qa-message-button"
          onClick={() => onMessage(member)}
          aria-label={
            ar ? `إرسال رسالة إلى ${member.displayName}` : `Message ${member.displayName}`
          }
        >
          <MessageCircle size={17} aria-hidden="true" />
          <span>{text('qa.startConversation', ar ? 'ابدأ محادثة' : 'Start a conversation')}</span>
          <ArrowUpRight size={17} aria-hidden="true" />
        </button>
      </div>
    </motion.article>
  );
}

function GuestChat({
  member,
  locale,
  onClose,
}: {
  member: TeamMember;
  locale: Locale;
  onClose: () => void;
}) {
  const ar = locale === 'ar';
  const dialog = useRef<HTMLDialogElement>(null);
  const reduced = useReducedMotion();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);
  useEffect(() => {
    let id: string | null = null;
    try {
      id = localStorage.getItem(storageKey(member.id));
    } catch {}
    if (id && /^[a-f0-9-]{36}$/.test(id)) setConversationId(id);
    setRestoreDone(true);
  }, [member.id]);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      className="team-chat-dialog"
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      aria-label={
        ar ? `محادثة مع ${member.displayName}` : `Conversation with ${member.displayName}`
      }
    >
      <motion.div
        className="team-chat-sheet"
        initial={reduced ? false : { opacity: 0, y: 25, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="team-chat-header">
          <MemberAvatar member={member} />
          <div>
            <p className="team-section-label">
              {ar ? member.titleAr || member.titleEn : member.titleEn}
            </p>
            <h2>{member.displayName}</h2>
          </div>
          <button
            className="team-round-button"
            onClick={onClose}
            aria-label={ar ? 'إغلاق المحادثة' : 'Close conversation'}
          >
            <X size={20} />
          </button>
        </header>
        {!restoreDone ? (
          <p className="team-loading-copy" role="status">
            {ar ? 'جارٍ التحضير…' : 'Getting things ready…'}
          </p>
        ) : conversationId ? (
          <GuestThread
            key={conversationId}
            id={conversationId}
            member={member}
            locale={locale}
            onNew={() => {
              remember(member.id, null);
              setConversationId(null);
            }}
          />
        ) : (
          <NewConversation
            member={member}
            locale={locale}
            onCreated={(id) => {
              remember(member.id, id);
              setConversationId(id);
            }}
          />
        )}
      </motion.div>
    </dialog>
  );
}

function NewConversation({
  member,
  locale,
  onCreated,
}: {
  member: TeamMember;
  locale: Locale;
  onCreated: (id: string) => void;
}) {
  const ar = locale === 'ar';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setPending(true);
    setError(null);
    try {
      const result = await teamRequest<TeamConversation>('/conversations', {
        method: 'POST',
        body: JSON.stringify({
          memberId: member.id,
          name: String(values.get('name') || '').trim(),
          email: String(values.get('email') || '').trim(),
          body: String(values.get('body') || '').trim(),
          consent: values.get('consent') === 'on',
        }),
      });
      onCreated(result.id);
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="team-new-conversation" onSubmit={submit}>
      <div className="team-chat-intro">
        <span className="team-chat-icon">
          <MessageCircle size={23} />
        </span>
        <h3>{ar ? 'ماذا يدور في بالك؟' : 'What’s on your mind?'}</h3>
        <p>
          {ar
            ? 'اكتب سؤالك أو فكرتك. ستصل رسالتك إلى هذا الشخص مباشرةً ويمكنك متابعة الرد هنا.'
            : 'A question, an idea, a next step. Your message goes directly to this team member, and their reply appears here.'}
        </p>
      </div>
      <label className="team-field">
        {ar ? 'اسمك' : 'Your name'}
        <input
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={160}
          placeholder={ar ? 'كيف نناديك؟' : 'What should we call you?'}
        />
      </label>
      <label className="team-field">
        {ar ? 'البريد الإلكتروني' : 'Email address'}
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          dir="ltr"
          placeholder="you@example.com"
        />
      </label>
      <label className="team-field">
        {ar ? 'رسالتك' : 'Your message'}
        <textarea
          name="body"
          required
          minLength={1}
          maxLength={3000}
          rows={4}
          placeholder={ar ? 'لنبدأ الحديث…' : 'Let’s start a conversation…'}
        />
      </label>
      <label className="team-consent">
        <input name="consent" type="checkbox" required />
        <span>
          {ar
            ? 'أوافق على استخدام بياناتي للرد على هذه المحادثة.'
            : 'I agree to my details being used to respond to this conversation.'}
        </span>
      </label>
      {error ? (
        <p className="team-form-error" role="alert">
          {teamError(error, locale)}
        </p>
      ) : null}
      <button type="submit" className="button button-primary team-full-button" disabled={pending}>
        {pending ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : ar ? 'أرسل رسالتك' : 'Send your message'}
        <Send size={16} />
      </button>
      <p className="team-private-copy">
        <LockKeyhole size={12} />
        {ar
          ? 'المحادثة خاصة ويمكن متابعتها من هذا المتصفح.'
          : 'Private to your chosen team member. Continue in this browser.'}
      </p>
    </form>
  );
}

function GuestThread({
  id,
  member,
  locale,
  onNew,
}: {
  id: string;
  member: TeamMember;
  locale: Locale;
  onNew: () => void;
}) {
  const ar = locale === 'ar';
  const { thread, loading, error, loadOlder, olderLoading, appendMessage } = useConversation(
    `/conversations/${id}`,
  );
  const [pending, setPending] = useState(false);
  const [sendError, setSendError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') || '').trim();
    if (!body) return;
    setPending(true);
    setSendError(null);
    setSent(false);
    try {
      const result = await teamRequest<{ message: TeamMessage; updatedAt: string }>(
        `/conversations/${id}/messages`,
        { method: 'POST', body: JSON.stringify({ body }) },
      );
      appendMessage(result.message, result.updatedAt);
      form.reset();
      setSent(true);
    } catch (failure) {
      setSendError(failure);
    } finally {
      setPending(false);
    }
  }
  if (loading)
    return (
      <p className="team-loading-copy" role="status">
        {ar ? 'جارٍ تحميل المحادثة…' : 'Opening your conversation…'}
      </p>
    );
  if (!thread)
    return (
      <div className="team-empty-state">
        <LockKeyhole size={26} />
        <h3>{ar ? 'لا يمكن فتح هذه المحادثة.' : 'This conversation can’t be opened.'}</h3>
        <p>
          {error instanceof TeamApiError && [401, 404].includes(error.status)
            ? ar
              ? 'ابدأ محادثة جديدة من هذا المتصفح.'
              : 'Start a new conversation from this browser.'
            : teamError(error, locale)}
        </p>
        <button className="button button-primary" onClick={onNew}>
          {ar ? 'ابدأ محادثة جديدة' : 'Start a new conversation'}
        </button>
      </div>
    );
  return (
    <>
      <div className="team-chat-status">
        <span className="status-dot" />
        {ar ? 'ستظهر الردود هنا تلقائياً.' : 'Replies appear here automatically.'}
        <LockKeyhole size={13} />
      </div>
      {thread.hasMore ? (
        <button
          className="team-older-button"
          onClick={() => void loadOlder()}
          disabled={olderLoading}
        >
          {olderLoading
            ? ar
              ? 'جارٍ التحميل…'
              : 'Loading…'
            : ar
              ? 'عرض الرسائل السابقة'
              : 'Show earlier messages'}
        </button>
      ) : null}
      <MessageList messages={thread.messages} locale={locale} memberName={member.displayName} />
      {error ? (
        <p className="team-inline-error" role="status">
          {teamError(error, locale)}
        </p>
      ) : null}
      <form className="team-message-composer" onSubmit={send}>
        <label className="team-field">
          <span className="team-sr-only">{ar ? 'اكتب ردّك' : 'Write your reply'}</span>
          <textarea
            name="body"
            required
            minLength={1}
            maxLength={3000}
            rows={2}
            placeholder={ar ? 'أكمل الحديث…' : 'Keep the conversation going…'}
          />
        </label>
        {sendError ? (
          <p className="team-form-error" role="alert">
            {teamError(sendError, locale)}
          </p>
        ) : null}
        <div className="team-composer-footer">
          <p>
            {sent ? (
              <>
                <Check size={13} />
                {ar ? 'تم إرسال الرسالة' : 'Message sent'}
              </>
            ) : (
              <>
                <LockKeyhole size={12} />
                {ar ? 'خاص بهذا المتصفح' : 'Private to this browser'}
              </>
            )}
          </p>
          <button className="button button-primary" disabled={pending} type="submit">
            {pending ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : ar ? 'إرسال' : 'Send'}
            <Send size={15} />
          </button>
        </div>
      </form>
    </>
  );
}
