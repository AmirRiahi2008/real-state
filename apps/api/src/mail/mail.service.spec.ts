import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { Prisma, TokenPurpose } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MailService } from './mail.service';

const config = () =>
  new ConfigService({
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_SECURE: false,
    SMTP_FROM: 'Estate <no-reply@example.test>',
    FRONTEND_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  });

function workerFixture(claimCount = 1, failing = false) {
  let lease: Date | null = null;
  const updateMany = jest.fn(async (input: Prisma.EmailOutboxUpdateManyArgs) => {
    if (input.data.attempts) {
      lease = input.data.lockedUntil as Date;
      return { count: claimCount };
    }
    return { count: 1 };
  });
  const id = 'e9cc6a3b-17b5-4652-be34-fcda115d97a9';
  const findUnique = jest.fn(async () => ({
    id,
    to: 'synthetic@example.test',
    subject: 'Verify email',
    text: 'secret-token-link',
    attempts: 1,
    lockedUntil: lease,
    expiresAt: new Date(Date.now() + 60000),
  }));
  const prisma = {
    emailOutbox: { updateMany, findMany: jest.fn(async () => [{ id }]), findUnique },
  } as unknown as PrismaService;
  const sendMail = jest.fn(async (_message: unknown) => {
    if (failing) throw new Error('synthetic SMTP failure');
    return { messageId: 'id' };
  });
  const service = new MailService(prisma, config());
  Object.defineProperty(service, 'transport', { value: { sendMail, close: jest.fn() } });
  return { service, updateMany, sendMail, id };
}

describe('durable token email outbox', () => {
  it('enqueues the token link and expiration in the caller transaction', async () => {
    const create = jest.fn(async (_input: Prisma.EmailOutboxCreateArgs) => ({}));
    const db = { emailOutbox: { create } } as unknown as Prisma.TransactionClient;
    const service = new MailService({} as PrismaService, config());
    const expiresAt = new Date(Date.now() + 60000);
    await service.queueTokenEmail(
      'synthetic@example.test',
      TokenPurpose.RESET_PASSWORD,
      'a-random-token',
      expiresAt,
      db,
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        to: 'synthetic@example.test',
        expiresAt,
        text: expect.stringContaining('http://localhost:3000/reset-password?token=a-random-token'),
      }),
    });
    service.onModuleDestroy();
  });

  it('claims atomically, sends once and removes recipient and secret content after delivery', async () => {
    const f = workerFixture();
    await f.service.processOutbox();
    expect(f.sendMail).toHaveBeenCalledTimes(1);
    expect(f.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: `<${f.id}@real-estate-outbox>` }),
    );
    expect(f.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ id: f.id, sentAt: null, lockedUntil: expect.any(Date) }),
      data: { sentAt: expect.any(Date), to: '', subject: '', text: '', lockedUntil: null },
    });
    f.service.onModuleDestroy();
  });

  it('does not deliver a message claimed by another replica', async () => {
    const f = workerFixture(0);
    await f.service.processOutbox();
    expect(f.sendMail).not.toHaveBeenCalled();
    f.service.onModuleDestroy();
  });

  it('releases the lease with a delayed bounded retry when SMTP fails', async () => {
    const f = workerFixture(1, true);
    await f.service.processOutbox();
    expect(f.sendMail).toHaveBeenCalledTimes(1);
    expect(f.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({ id: f.id, lockedUntil: expect.any(Date) }),
      data: { lockedUntil: null, nextAttemptAt: expect.any(Date) },
    });
    const retry = f.updateMany.mock.calls.at(-1)?.[0].data.nextAttemptAt as Date;
    expect(retry.getTime()).toBeGreaterThan(Date.now() + 50000);
    f.service.onModuleDestroy();
  });
});
