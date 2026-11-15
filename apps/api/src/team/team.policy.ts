import { Prisma, Role } from '@prisma/client';

export const teamProfileRoles: Role[] = [Role.TEAM_MEMBER, Role.ADMIN];

export const publicTeamWhere = {
  isPublic: true,
  user: { isActive: true, role: { in: teamProfileRoles } },
} satisfies Prisma.TeamProfileWhereInput;

export const teamMemberSelect = {
  id: true,
  slug: true,
  displayName: true,
  titleEn: true,
  titleAr: true,
  bioEn: true,
  bioAr: true,
  avatarMediaId: true,
  updatedAt: true,
} satisfies Prisma.TeamProfileSelect;

export type TeamMemberRecord = Prisma.TeamProfileGetPayload<{ select: typeof teamMemberSelect }>;

export function presentTeamMember(profile: TeamMemberRecord) {
  return {
    id: profile.id,
    slug: profile.slug,
    displayName: profile.displayName,
    titleEn: profile.titleEn,
    titleAr: profile.titleAr,
    bioEn: profile.bioEn,
    bioAr: profile.bioAr,
    updatedAt: profile.updatedAt,
    photoUrl: profile.avatarMediaId ? `/api/v1/media/${profile.avatarMediaId}/file` : null,
  };
}
