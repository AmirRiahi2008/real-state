'use client';

import { useState } from 'react';
import { mediaUrl } from '@/lib/api';
import type { TeamMember } from '@/lib/team-types';

export default function MemberAvatar({
  member,
  className = '',
  portrait = false,
}: {
  member: TeamMember;
  className?: string;
  portrait?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial = member.displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('');
  return (
    <span className={`${portrait ? 'team-portrait' : 'team-avatar'} ${className}`}>
      {member.photoUrl && failedUrl !== member.photoUrl ? (
        <img
          src={mediaUrl(member.photoUrl)}
          alt={member.displayName}
          width={portrait ? 600 : 80}
          height={portrait ? 750 : 80}
          loading={portrait ? 'eager' : 'lazy'}
          onError={() => setFailedUrl(member.photoUrl)}
        />
      ) : (
        <span className="team-avatar-initial" aria-label={member.displayName}>
          {initial}
        </span>
      )}
    </span>
  );
}
