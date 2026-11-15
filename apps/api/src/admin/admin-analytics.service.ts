import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto, paginated } from '../common/pagination.dto';
const auditSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  createdAt: true,
  actor: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;
@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}
  async overview(days: number) {
    const to = new Date();
    const from = new Date(to);
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    const [
      listings,
      publishedListings,
      projects,
      publishedProjects,
      leads,
      newLeads,
      users,
      teamMembers,
      conversations,
      listingStatuses,
      leadStatuses,
      listingPurposes,
      recentActivity,
      recentLeads,
      leadDaily,
      listingDaily,
      projectDaily,
      conversationDaily,
    ] = await Promise.all([
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.project.count(),
      this.prisma.project.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { status: 'NEW' } }),
      this.prisma.user.count(),
      this.prisma.teamProfile.count(),
      this.prisma.teamConversation.count(),
      this.prisma.listing.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.listing.groupBy({ by: ['purpose'], _count: { _all: true } }),
      this.prisma.auditLog.findMany({
        select: auditSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 8,
      }),
      this.prisma.lead.findMany({
        select: { id: true, name: true, type: true, status: true, createdAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
      this.prisma.$queryRaw<
        { date: string; count: number }[]
      >`SELECT to_char("createdAt", 'YYYY-MM-DD') AS date, COUNT(*)::int AS count FROM "Lead" WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} GROUP BY date`,
      this.prisma.$queryRaw<
        { date: string; count: number }[]
      >`SELECT to_char("createdAt", 'YYYY-MM-DD') AS date, COUNT(*)::int AS count FROM "Listing" WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} GROUP BY date`,
      this.prisma.$queryRaw<
        { date: string; count: number }[]
      >`SELECT to_char("createdAt", 'YYYY-MM-DD') AS date, COUNT(*)::int AS count FROM "Project" WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} GROUP BY date`,
      this.prisma.$queryRaw<
        { date: string; count: number }[]
      >`SELECT to_char("createdAt", 'YYYY-MM-DD') AS date, COUNT(*)::int AS count FROM "TeamConversation" WHERE "createdAt" >= ${from} AND "createdAt" <= ${to} GROUP BY date`,
    ]);
    const byDay = (rows: { date: string; count: number }[]) =>
      new Map(rows.map((row) => [row.date, row.count]));
    const leadMap = byDay(leadDaily),
      listingMap = byDay(listingDaily),
      projectMap = byDay(projectDaily),
      conversationMap = byDay(conversationDaily);
    const daily = Array.from({ length: days }, (_, i) => {
      const day = new Date(from);
      day.setUTCDate(day.getUTCDate() + i);
      const date = day.toISOString().slice(0, 10);
      return {
        date,
        leads: leadMap.get(date) ?? 0,
        listings: listingMap.get(date) ?? 0,
        projects: projectMap.get(date) ?? 0,
        conversations: conversationMap.get(date) ?? 0,
      };
    });
    return {
      window: { days, from, to, timeZone: 'UTC' },
      summary: {
        listings,
        publishedListings,
        projects,
        publishedProjects,
        leads,
        newLeads,
        users,
        teamMembers,
        conversations,
      },
      daily,
      listingStatuses: listingStatuses.map((r) => ({ status: r.status, count: r._count._all })),
      leadStatuses: leadStatuses.map((r) => ({ status: r.status, count: r._count._all })),
      listingPurposes: listingPurposes.map((r) => ({ purpose: r.purpose, count: r._count._all })),
      recentActivity,
      recentLeads,
    };
  }
  async audit(q: PaginationDto) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        select: auditSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.auditLog.count(),
    ]);
    return paginated(rows, total, q.page, q.limit);
  }
}
