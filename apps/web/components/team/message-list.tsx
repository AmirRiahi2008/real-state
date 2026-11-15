'use client';

import { useEffect, useRef } from 'react';
import { Check, LockKeyhole, Send } from 'lucide-react';
import type { Locale } from '@/lib/api';
import type { TeamConversation, TeamMessage } from '@/lib/team-types';

export function MessageList({
  messages,
  locale,
  memberName,
  staff = false,
}: {
  messages: TeamMessage[];
  locale: Locale;
  memberName: string;
  staff?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const lastMessage = messages.at(-1)?.id;
  const previousLast = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastMessage !== previousLast.current && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
      previousLast.current = lastMessage;
    }
  }, [lastMessage]);
  const ar = locale === 'ar';
  const time = new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <div className="team-message-list" ref={scroller} aria-label={ar ? 'الرسائل' : 'Messages'}>
      {messages.map((message) => {
        const own = staff ? message.sender === 'STAFF' : message.sender === 'VISITOR';
        return (
          <article key={message.id} className={`team-message ${own ? 'is-own' : 'is-received'}`}>
            <p className="team-message-byline">
              {message.sender === 'STAFF' ? memberName : ar ? 'الزائر' : 'Visitor'}
            </p>
            <p className="team-message-body" dir="auto">
              {message.body}
            </p>
            <p className="team-message-time">
              <time dateTime={message.createdAt}>{time.format(new Date(message.createdAt))}</time>
              {own ? <Check size={12} aria-hidden="true" /> : null}
            </p>
          </article>
        );
      })}
    </div>
  );
}

export function ThreadHeading({ thread, locale }: { thread: TeamConversation; locale: Locale }) {
  const ar = locale === 'ar';
  return (
    <div className="team-thread-heading">
      <div>
        <span className="team-section-label">{ar ? 'محادثة خاصة' : 'PRIVATE CONVERSATION'}</span>
        <h3>{thread.name}</h3>
        <p>{thread.email}</p>
      </div>
      <span className="team-private-mark">
        <LockKeyhole size={17} aria-hidden="true" />
        {ar ? 'خاص' : 'Private'}
      </span>
    </div>
  );
}

export function SendIcon() {
  return <Send size={16} aria-hidden="true" />;
}
