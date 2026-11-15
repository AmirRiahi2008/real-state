import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, TeamMessageSender } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { hashToken, isOpaqueToken, randomToken } from '../auth/token.utils';
import { AuditService } from '../audit/audit.service';
import { PaginationDto, paginated } from '../common/pagination.dto';
import { PrismaService } from '../database/prisma.service';
import { ConversationMessageDto, CreateTeamConversationDto, TeamMessageQueryDto } from './team.dto';
import {
  presentTeamMember,
  publicTeamWhere,
  teamMemberSelect,
  teamProfileRoles,
} from './team.policy';

const messageSelect = {
  id: true,
  body: true,
  sender: true,
  createdAt: true,
} satisfies Prisma.TeamMessageSelect;
const threadSelect = {
  id: true,
  memberId: true,
  visitorName: true,
  visitorEmail: true,
  createdAt: true,
  updatedAt: true,
  member: { select: teamMemberSelect },
} satisfies Prisma.TeamConversationSelect;
type ThreadRecord = Prisma.TeamConversationGetPayload<{ select: typeof threadSelect }>;

const presentThread = (row: ThreadRecord) => {
  const { visitorName, visitorEmail, member, ...thread } = row;
  return { ...thread, name: visitorName, email: visitorEmail, member: presentTeamMember(member) };
};

@Injectable()
export class TeamConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateTeamConversationDto) {
    const accessToken = randomToken();
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    const row = await this.prisma.$transaction(async (db) => {
      const member = await db.teamProfile.findFirst({
        where: { id: dto.memberId, ...publicTeamWhere },
        select: { id: true },
      });
      if (!member) throw new NotFoundException('Team member not found');
      const created = await db.teamConversation.create({
        data: {
          memberId: member.id,
          visitorName: dto.name,
          visitorEmail: dto.email,
          visitorTokenHash: hashToken(accessToken),
          visitorTokenExpiresAt: expiresAt,
          consentAt: new Date(),
          messages: { create: { sender: TeamMessageSender.VISITOR, body: dto.body } },
        },
        select: { ...threadSelect, messages: { select: messageSelect, take: 1 } },
      });
      await this.audit.record(
        null,
        'team.conversation_created',
        'TeamConversation',
        created.id,
        {},
        db,
      );
      return created;
    });
    const { messages, ...thread } = row;
    return {
      ...presentThread(thread),
      messages,
      hasMore: false,
      nextBefore: null,
      accessToken,
      expiresAt,
    };
  }

  async visitorThread(id: string, token: string | undefined, query: TeamMessageQueryDto) {
    const row = await this.prisma.teamConversation.findFirst({
      where: this.visitorScope(id, token),
      select: threadSelect,
    });
    if (!row) throw new NotFoundException('Conversation not found');
    return { ...presentThread(row), ...(await this.messages(id, query)) };
  }

  async visitorMessage(id: string, token: string | undefined, dto: ConversationMessageDto) {
    const where = this.visitorScope(id, token);
    return this.prisma.$transaction(async (db) => {
      const updatedAt = new Date();
      // The scoped update acquires the row lock before appending a message.
      const changed = await db.teamConversation.updateMany({ where, data: { updatedAt } });
      if (changed.count !== 1) throw new NotFoundException('Conversation not found');
      const message = await db.teamMessage.create({
        data: { conversationId: id, sender: TeamMessageSender.VISITOR, body: dto.body },
        select: messageSelect,
      });
      return { message, updatedAt };
    });
  }

  async inbox(
    actor: AuthUser,
    query: PaginationDto,
    asAdministrator = false,
    filter: { memberId?: string; q?: string } = {},
  ) {
    const scope = this.staffScope(actor, asAdministrator);
    const where = {
      member: scope,
      ...(filter.memberId ? { memberId: filter.memberId } : {}),
      ...(filter.q
        ? {
            OR: [
              { visitorName: { contains: filter.q, mode: 'insensitive' as const } },
              { visitorEmail: { contains: filter.q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    } satisfies Prisma.TeamConversationWhereInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.teamConversation.findMany({
        where,
        select: {
          ...threadSelect,
          messages: {
            select: messageSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
          },
          _count: { select: { messages: true } },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.teamConversation.count({ where }),
    ]);
    return paginated(
      rows.map(({ messages, _count, ...row }) => ({
        ...presentThread(row),
        lastMessage: messages[0] ?? null,
        messageCount: _count.messages,
      })),
      total,
      query.page,
      query.limit,
    );
  }

  async staffThread(
    actor: AuthUser,
    id: string,
    query: TeamMessageQueryDto,
    asAdministrator = false,
  ) {
    const row = await this.prisma.teamConversation.findFirst({
      where: { id, member: this.staffScope(actor, asAdministrator) },
      select: threadSelect,
    });
    if (!row) throw new NotFoundException('Conversation not found');
    return { ...presentThread(row), ...(await this.messages(id, query)) };
  }

  async reply(actor: AuthUser, id: string, dto: ConversationMessageDto, asAdministrator = false) {
    const scope = this.staffScope(actor, asAdministrator);
    return this.prisma.$transaction(async (db) => {
      const updatedAt = new Date();
      const changed = await db.teamConversation.updateMany({
        where: { id, member: scope },
        data: { updatedAt },
      });
      if (changed.count !== 1) throw new NotFoundException('Conversation not found');
      const message = await db.teamMessage.create({
        data: { conversationId: id, sender: TeamMessageSender.STAFF, body: dto.body },
        select: messageSelect,
      });
      await this.audit.record(
        actor.id,
        'team.conversation_replied',
        'TeamConversation',
        id,
        {},
        db,
      );
      return { message, updatedAt };
    });
  }

  private visitorScope(id: string, token: string | undefined): Prisma.TeamConversationWhereInput {
    if (!isOpaqueToken(token)) throw new NotFoundException('Conversation not found');
    return {
      id,
      visitorTokenHash: hashToken(token),
      visitorTokenExpiresAt: { gt: new Date() },
      member: publicTeamWhere,
    };
  }

  private staffScope(actor: AuthUser, asAdministrator = false): Prisma.TeamProfileWhereInput {
    if (asAdministrator) {
      if (actor.role !== Role.ADMIN) throw new NotFoundException('Conversation not found');
      return {};
    }
    if (!teamProfileRoles.includes(actor.role))
      throw new NotFoundException('Team profile not found');
    return { userId: actor.id, user: { isActive: true, role: { in: teamProfileRoles } } };
  }

  private async messages(conversationId: string, query: TeamMessageQueryDto) {
    let older: Prisma.TeamMessageWhereInput = {};
    if (query.before) {
      const cursor = await this.prisma.teamMessage.findFirst({
        where: { id: query.before, conversationId },
        select: { id: true, createdAt: true },
      });
      if (!cursor) throw new NotFoundException('Message not found');
      older = {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      };
    }
    const rows = await this.prisma.teamMessage.findMany({
      where: { conversationId, ...older },
      select: messageSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 101,
    });
    const hasMore = rows.length > 100;
    const messages = rows.slice(0, 100).reverse();
    return { messages, hasMore, nextBefore: hasMore ? (messages[0]?.id ?? null) : null };
  }
}
