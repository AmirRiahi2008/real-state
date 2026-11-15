export interface TeamMember {
  id: string;
  slug: string;
  displayName: string;
  titleEn: string;
  titleAr: string;
  bioEn: string;
  bioAr: string;
  photoUrl: string | null;
  updatedAt: string;
}

export interface OwnTeamProfile extends TeamMember {
  email: string;
  avatarMediaId?: string | null;
}

export interface TeamSession {
  user: { id: string; email: string; firstName: string; lastName: string; role: string };
  profile: OwnTeamProfile;
}

export interface TeamMessage {
  id: string;
  body: string;
  sender: 'VISITOR' | 'STAFF';
  createdAt: string;
}

export interface TeamConversation {
  id: string;
  memberId: string;
  name: string;
  email: string;
  member: TeamMember;
  messages: TeamMessage[];
  createdAt: string;
  updatedAt: string;
  hasMore?: boolean;
  nextBefore?: string | null;
}

export interface TeamInboxConversation extends Omit<
  TeamConversation,
  'messages' | 'hasMore' | 'nextBefore'
> {
  lastMessage: TeamMessage | null;
  messageCount: number;
}

export interface TeamPage<T> {
  data: T[];
  meta?: { page?: number; limit?: number; total?: number; totalPages?: number };
}
