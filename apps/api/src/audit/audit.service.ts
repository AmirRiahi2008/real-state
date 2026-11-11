import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}
  async record(
    actorId: string | null,
    action: string,
    entityType: string,
    entityId?: string,
    metadata: Prisma.InputJsonObject = {},
    db: Pick<PrismaClient, 'auditLog'> = this.prisma,
  ): Promise<void> {
    await db.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });
  }
}
