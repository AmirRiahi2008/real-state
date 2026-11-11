import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, TokenPurpose, User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto';
import { PasswordService } from './password.service';
import { hashToken, isOpaqueToken, randomToken } from './token.utils';

type PublicUserFields = Pick<
  User,
  'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'emailVerifiedAt'
>;
export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  emailVerified: boolean;
}
export interface AuthResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: SafeUser;
  refreshToken: string;
  expiresAt: Date;
}
const safeUser = (user: PublicUserFields): SafeUser => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  emailVerified: user.emailVerifiedAt !== null,
});
const profileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  emailVerifiedAt: true,
} satisfies Prisma.UserSelect;
const registrationMessage = {
  message: 'If registration can be completed, check your email for the next step.',
};
const resetMessage = {
  message: 'If an eligible account exists, password reset instructions will be sent.',
};

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}
  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.passwords.hash(randomToken());
  }

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await this.passwords.hash(dto.password);
    if (await this.prisma.user.findUnique({ where: { email }, select: { id: true } }))
      return registrationMessage;
    try {
      await this.prisma.$transaction(async (db) => {
        const user = await db.user.create({
          data: {
            email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            role: Role.CUSTOMER,
          },
        });
        await this.queueOneTimeToken(user, TokenPurpose.VERIFY_EMAIL, db);
        await this.audit.record(user.id, 'auth.registered', 'User', user.id, {}, db);
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'))
        throw error;
    }
    return registrationMessage;
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    const valid = await this.passwords.verify(user?.passwordHash ?? this.dummyHash, dto.password);
    if (!user || !valid || !user.isActive)
      throw new UnauthorizedException('Invalid email or password');
    const token = randomToken();
    const expiresAt = new Date(
      Date.now() + this.config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 86400000,
    );
    const session = await this.prisma.$transaction(async (db) => {
      // Lock the credential row so a concurrent password reset cannot be followed
      // by creation of a session authenticated with the old password hash.
      const credential = await db.user.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash, isActive: true },
        data: { passwordHash: user.passwordHash },
      });
      if (credential.count !== 1) throw new UnauthorizedException('Invalid email or password');
      const created = await db.authSession.create({
        data: { userId: user.id, familyId: randomUUID(), tokenHash: hashToken(token), expiresAt },
      });
      await this.audit.record(user.id, 'auth.login', 'AuthSession', created.id, {}, db);
      return created;
    });
    return this.result(user, session.id, token, expiresAt);
  }

  async refresh(token: string | undefined): Promise<AuthResult> {
    if (!isOpaqueToken(token)) throw new UnauthorizedException('Invalid or expired session');
    const nextToken = randomToken();
    const outcome = await this.prisma.$transaction(async (db) => {
      const current = await db.authSession.findUnique({
        where: { tokenHash: hashToken(token) },
        include: { user: true },
      });
      if (!current) return null;
      const credential = await db.user.updateMany({
        where: { id: current.userId, passwordHash: current.user.passwordHash, isActive: true },
        data: { passwordHash: current.user.passwordHash },
      });
      const now = new Date();
      if (current.revokedAt || current.expiresAt <= now || credential.count !== 1) {
        await db.authSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        await this.audit.record(
          current.userId,
          current.revokedAt ? 'auth.refresh_reuse' : 'auth.refresh_rejected',
          'AuthSession',
          current.id,
          {},
          db,
        );
        return null;
      }
      const consumed = await db.authSession.updateMany({
        where: { id: current.id, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      if (consumed.count !== 1) {
        await db.authSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        await this.audit.record(
          current.userId,
          'auth.refresh_reuse',
          'AuthSession',
          current.id,
          {},
          db,
        );
        return null;
      }
      const session = await db.authSession.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: hashToken(nextToken),
          expiresAt: current.expiresAt,
        },
      });
      await this.audit.record(current.userId, 'auth.refreshed', 'AuthSession', session.id, {}, db);
      return { user: current.user, session };
    });
    // Throw outside the transaction: replay-family revocation must be committed.
    if (!outcome) throw new UnauthorizedException('Invalid or expired session');
    return this.result(outcome.user, outcome.session.id, nextToken, outcome.session.expiresAt);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!isOpaqueToken(token)) return;
    await this.prisma.$transaction(async (db) => {
      const session = await db.authSession.findUnique({
        where: { tokenHash: hashToken(token) },
        select: { id: true, familyId: true, userId: true },
      });
      if (!session) return;
      await this.lockUser(session.userId, db);
      await db.authSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(session.userId, 'auth.logout', 'AuthSession', session.id, {}, db);
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction(async (db) => {
      await this.lockUser(userId, db);
      await db.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(userId, 'auth.logout_all', 'User', userId, {}, db);
    });
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });
    if (!user) throw new UnauthorizedException('Invalid or expired session');
    return safeUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      !user.isActive ||
      !(await this.passwords.verify(user.passwordHash, dto.currentPassword))
    )
      throw new UnauthorizedException('Current password is incorrect');
    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException('Choose a different password');
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction(async (db) => {
      const changed = await db.user.updateMany({
        where: { id: userId, passwordHash: user.passwordHash, isActive: true },
        data: { passwordHash },
      });
      if (changed.count !== 1) throw new ConflictException('Credentials changed; sign in again');
      await db.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await db.oneTimeToken.updateMany({
        where: { userId, purpose: TokenPurpose.RESET_PASSWORD, usedAt: null },
        data: { usedAt: new Date() },
      });
      await this.audit.record(userId, 'auth.password_changed', 'User', userId, {}, db);
    });
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (user?.isActive) {
      await this.prisma.$transaction(async (db) => {
        await this.queueOneTimeToken(user, TokenPurpose.RESET_PASSWORD, db);
        await this.audit.record(user.id, 'auth.password_reset_requested', 'User', user.id, {}, db);
      });
    }
    return resetMessage;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction(async (db) => {
      const token = await this.consumeToken(dto.token, TokenPurpose.RESET_PASSWORD, db);
      const changed = await db.user.updateMany({
        where: { id: token.userId, isActive: true },
        data: { passwordHash },
      });
      if (changed.count !== 1) throw new BadRequestException('Invalid or expired token');
      await db.authSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await db.oneTimeToken.updateMany({
        where: { userId: token.userId, purpose: TokenPurpose.RESET_PASSWORD, usedAt: null },
        data: { usedAt: new Date() },
      });
      await this.audit.record(token.userId, 'auth.password_reset', 'User', token.userId, {}, db);
    });
    return { message: 'Password reset. Sign in with your new password.' };
  }

  async verifyEmail(rawToken: string): Promise<{ message: string }> {
    await this.prisma.$transaction(async (db) => {
      const token = await this.consumeToken(rawToken, TokenPurpose.VERIFY_EMAIL, db);
      const changed = await db.user.updateMany({
        where: { id: token.userId, isActive: true },
        data: { emailVerifiedAt: new Date() },
      });
      if (changed.count !== 1) throw new BadRequestException('Invalid or expired token');
      await this.audit.record(token.userId, 'auth.email_verified', 'User', token.userId, {}, db);
    });
    return { message: 'Email verified.' };
  }

  async resendVerification(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.isActive && !user.emailVerifiedAt)
      await this.prisma.$transaction((db) =>
        this.queueOneTimeToken(user, TokenPurpose.VERIFY_EMAIL, db),
      );
    return { message: 'If verification is needed, instructions will be sent.' };
  }

  private async consumeToken(
    rawToken: string,
    purpose: TokenPurpose,
    db: Prisma.TransactionClient,
  ) {
    const token = await db.oneTimeToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
    if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt <= new Date())
      throw new BadRequestException('Invalid or expired token');
    await this.lockUser(token.userId, db);
    const now = new Date();
    const consumed = await db.oneTimeToken.updateMany({
      where: { id: token.id, purpose, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) throw new BadRequestException('Invalid or expired token');
    return token;
  }

  private async lockUser(userId: string, db: Prisma.TransactionClient): Promise<void> {
    // Parameterized row lock establishes a consistent user → session lock order.
    await db.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
  }

  private async queueOneTimeToken(
    user: Pick<User, 'id' | 'email'>,
    purpose: TokenPurpose,
    db: Prisma.TransactionClient,
  ): Promise<void> {
    await this.lockUser(user.id, db);
    const rawToken = randomToken();
    const expiresAt = new Date(
      Date.now() + (purpose === TokenPurpose.RESET_PASSWORD ? 15 * 60000 : 24 * 3600000),
    );
    await db.oneTimeToken.updateMany({
      where: { userId: user.id, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    await db.oneTimeToken.create({
      data: { userId: user.id, purpose, tokenHash: hashToken(rawToken), expiresAt },
    });
    await this.mail.queueTokenEmail(user.email, purpose, rawToken, expiresAt, db);
  }

  private async result(
    user: PublicUserFields,
    sessionId: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<AuthResult> {
    const expiresIn = this.config.getOrThrow<number>('ACCESS_TOKEN_TTL_SECONDS');
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, kind: 'access' },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        algorithm: 'HS256',
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        audience: this.config.getOrThrow<string>('JWT_AUDIENCE'),
        expiresIn,
      },
    );
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: safeUser(user),
      refreshToken,
      expiresAt,
    };
  }
}
