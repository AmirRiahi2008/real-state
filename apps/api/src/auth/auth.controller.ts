import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { RateLimit } from '../common/rate-limit.decorator';
import { AuthUser } from './auth-user';
import { AuthCookiesService } from './auth-cookies.service';
import {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from './auth.dto';
import { AuthResult, AuthService } from './auth.service';
import { CurrentUser, Public } from './decorators';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookiesService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(202)
  @RateLimit(5, 60)
  @ApiOperation({ summary: 'Register a customer; verification is delivered by email' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @RateLimit(10, 60)
  @ApiOperation({ summary: 'Sign in; requires an allowlisted Origin header' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.cookies.assertOrigin(request);
    return this.present(await this.auth.login(dto), response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @RateLimit(30, 60)
  @ApiOperation({ summary: 'Rotate session; requires Origin, refresh cookie and X-CSRF-Token' })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    this.cookies.assertCsrf(request);
    try {
      return this.present(await this.auth.refresh(this.cookies.refreshToken(request)), response);
    } catch (error) {
      this.cookies.clear(response);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @RateLimit(30, 60)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.cookies.assertCsrf(request);
    await this.auth.logout(this.cookies.refreshToken(request));
    this.cookies.clear(response);
  }

  @Post('logout-all')
  @HttpCode(204)
  @ApiBearerAuth()
  @RateLimit(10, 60)
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.id);
    this.cookies.clear(response);
  }

  @Get('me')
  @ApiBearerAuth()
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Post('change-password')
  @HttpCode(204)
  @ApiBearerAuth()
  @RateLimit(5, 60)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.changePassword(user.id, dto);
    this.cookies.clear(response);
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(202)
  @RateLimit(3, 60)
  requestReset(@Body() dto: EmailDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(200)
  @RateLimit(5, 60)
  async reset(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.resetPassword(dto);
    this.cookies.clear(response);
    return result;
  }

  @Public()
  @Post('email/verify')
  @HttpCode(200)
  @RateLimit(10, 60)
  verify(@Body() dto: TokenDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('email/resend')
  @HttpCode(202)
  @ApiBearerAuth()
  @RateLimit(3, 60)
  resend(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.id);
  }

  private present(result: AuthResult, response: Response) {
    const { refreshToken, expiresAt, ...body } = result;
    const csrfToken = this.cookies.set(response, refreshToken, expiresAt);
    return { ...body, csrfToken };
  }
}
