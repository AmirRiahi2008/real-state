import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PublicationStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CreateContentDto, UpdateContentDto } from './content.dto';
import { ContentRepository, publicContentScope, publicContentSummary } from './content.repository';
import { ContentService } from './content.service';

describe('Content publication boundary', () => {
  it('limits public content to published records and omits administrative state', () => {
    expect(publicContentScope.status).toBe(PublicationStatus.PUBLISHED);
    expect(publicContentSummary).not.toHaveProperty('status');
    expect(publicContentSummary).not.toHaveProperty('version');
  });
  it('rejects raw HTML and publication-state injection', async () => {
    const dto = plainToInstance(CreateContentDto, {
      slug: 'buyer-guide',
      type: 'BUYER_GUIDE',
      titleEn: 'Buyer guide',
      titleAr: 'دليل المشتري',
      excerptEn: 'A guide',
      excerptAr: 'دليل الشراء',
      bodyEn: '<script>alert(1)</script>',
      bodyAr: 'خطوات شراء العقار في دبي',
      status: 'PUBLISHED',
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((error) => error.property === 'bodyEn')).toBe(true);
    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });
  it('does not allow null to clear required fields on partial update', async () => {
    const errors = await validate(plainToInstance(UpdateContentDto, { version: 1, titleEn: null }));
    expect(errors.some((error) => error.property === 'titleEn')).toBe(true);
  });
  it('rejects stale edits before audit or publication can be written', async () => {
    const db = {
      article: {
        findUnique: jest.fn().mockResolvedValue({ id: 'article', version: 2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (work: (transaction: typeof db) => Promise<unknown>) => work(db)),
    } as unknown as PrismaService;
    const audit = { record: jest.fn() } as unknown as AuditService;
    const service = new ContentService({} as ContentRepository, prisma, audit);
    await expect(
      service.update(
        'article',
        { version: 1, titleEn: 'New title' },
        { id: 'admin', email: 'admin@example.test', role: Role.ADMIN, sessionId: 'session' },
      ),
    ).rejects.toThrow(ConflictException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
