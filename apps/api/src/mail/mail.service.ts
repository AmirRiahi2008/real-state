import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Prisma, TokenPurpose } from '@prisma/client';
import nodemailer, { Transporter } from 'nodemailer';
import { PrismaService } from '../database/prisma.service';

const MAX_ATTEMPTS = 5;
const LEASE_MS = 30000;

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const secure = config.getOrThrow<boolean>('SMTP_SECURE');
    const user = config.get<string>('SMTP_USER');
    this.transport = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.getOrThrow<number>('SMTP_PORT'),
      secure,
      requireTLS: config.get<string>('NODE_ENV') === 'production' && !secure,
      ...(user ? { auth: { user, pass: config.getOrThrow<string>('SMTP_PASS') } } : {}),
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      tls: { minVersion: 'TLSv1.2' },
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  async queueTokenEmail(
    to: string,
    purpose: TokenPurpose,
    rawToken: string,
    expiresAt: Date,
    db: Prisma.TransactionClient,
  ): Promise<void> {
    const reset = purpose === TokenPurpose.RESET_PASSWORD;
    const url = new URL(
      reset ? '/reset-password' : '/verify-email',
      this.config.getOrThrow<string>('FRONTEND_URL'),
    );
    url.searchParams.set('token', rawToken);
    const subject = reset ? 'Reset your password' : 'Verify your email address';
    const text = `${subject}\n\n${url.toString()}\n\nThis single-use link expires at ${expiresAt.toISOString()}. If you did not request it, you can ignore this email.`;
    await db.emailOutbox.create({ data: { to, subject, text, expiresAt } });
  }

  /** Atomic leases coordinate replicas. SMTP delivery is deliberately at-least-once. */
  @Interval(5000)
  async processOutbox(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      await this.prisma.emailOutbox.updateMany({
        where: {
          sentAt: null,
          OR: [
            { expiresAt: { lte: now } },
            {
              attempts: { gte: MAX_ATTEMPTS },
              OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
            },
          ],
        },
        data: { sentAt: now, to: '', subject: '', text: '', lockedUntil: null },
      });
      const candidates = await this.prisma.emailOutbox.findMany({
        where: {
          sentAt: null,
          nextAttemptAt: { lte: now },
          attempts: { lt: MAX_ATTEMPTS },
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });
      for (const candidate of candidates) await this.deliver(candidate.id);
    } catch {
      this.logger.error(
        'Email outbox processing failed; no recipient or token details were logged',
      );
    } finally {
      this.running = false;
    }
  }

  private async deliver(id: string): Promise<void> {
    const now = new Date();
    const lease = new Date(now.getTime() + LEASE_MS);
    const claimed = await this.prisma.emailOutbox.updateMany({
      where: {
        id,
        sentAt: null,
        attempts: { lt: MAX_ATTEMPTS },
        nextAttemptAt: { lte: now },
        AND: [
          { OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      data: { lockedUntil: lease, attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) return;
    const message = await this.prisma.emailOutbox.findUnique({ where: { id } });
    if (!message || message.lockedUntil?.getTime() !== lease.getTime()) return;
    const owned = { id, sentAt: null, lockedUntil: lease };
    if (message.expiresAt && message.expiresAt <= new Date()) {
      await this.prisma.emailOutbox.updateMany({
        where: owned,
        data: { sentAt: new Date(), to: '', subject: '', text: '', lockedUntil: null },
      });
      return;
    }
    try {
      await this.transport.sendMail({
        from: this.config.getOrThrow<string>('SMTP_FROM'),
        to: message.to,
        subject: message.subject,
        text: message.text,
        messageId: `<${message.id}@real-estate-outbox>`,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      await this.prisma.emailOutbox.updateMany({
        where: owned,
        data: { sentAt: new Date(), to: '', subject: '', text: '', lockedUntil: null },
      });
    } catch {
      const exhausted = message.attempts >= MAX_ATTEMPTS;
      await this.prisma.emailOutbox.updateMany({
        where: owned,
        data: exhausted
          ? { sentAt: new Date(), to: '', subject: '', text: '', lockedUntil: null }
          : {
              lockedUntil: null,
              nextAttemptAt: new Date(
                Date.now() + Math.min(3600000, 30000 * 2 ** message.attempts),
              ),
            },
      });
      this.logger.warn(
        `Email outbox delivery ${exhausted ? 'exhausted' : 'scheduled for retry'}; job ${id}`,
      );
    }
  }

  onModuleDestroy(): void {
    this.transport.close();
  }
}
