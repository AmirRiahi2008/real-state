import type { Page } from '@playwright/test';
import type { TeamMember, TeamPage } from '../../lib/team-types';

// Layout checks run on a fresh CI database without personal accounts or uploaded portraits.
// Authenticated messaging/profile workflows have separate, opt-in private fixtures.
const members: TeamMember[] = [
  {
    id: 'c1000000-0000-4000-8000-000000000001',
    slug: 'amir-riahi',
    displayName: 'Amir Riahi',
    titleEn: 'Developer',
    titleAr: 'مطور',
    bioEn: 'Public layout fixture for the development team.',
    bioAr: 'بيانات اختبار لتصميم فريق التطوير.',
    photoUrl: '/images/property-01.webp',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-8000-000000000002',
    slug: 'mehdi-ahmadi',
    displayName: 'Mehdi Ahmadi',
    titleEn: 'Manager',
    titleAr: 'مدير',
    bioEn: 'Public layout fixture for the management team.',
    bioAr: 'بيانات اختبار لتصميم فريق الإدارة.',
    photoUrl: '/images/property-02.webp',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'c1000000-0000-4000-8000-000000000003',
    slug: 'melika',
    displayName: 'Melika',
    titleEn: 'Manager',
    titleAr: 'مديرة',
    bioEn: 'Public layout fixture for the featured team member.',
    bioAr: 'بيانات اختبار لتصميم بطاقة العضو الرئيسية.',
    photoUrl: '/images/property-03.webp',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

export async function usePublicTeamFixture(page: Page) {
  const body: TeamPage<TeamMember> = {
    data: members,
    meta: { page: 1, limit: 20, total: members.length, totalPages: 1 },
  };
  await page.route('**/api/team/members', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await route.fulfill({ json: body, headers: { 'Cache-Control': 'no-store' } });
  });
}
