import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [JwtModule.register({}), MailModule],
  controllers: [AuthController],
  providers: [AuthService, AuthCookiesService, PasswordService, AuthGuard, RolesGuard],
  exports: [AuthService, PasswordService, AuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
