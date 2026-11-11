import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { UsersQueryDto } from './users.dto';
export const safeUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}
  list(query: UsersQueryDto) {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q, mode: 'insensitive' } },
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: safeUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
  }
}
