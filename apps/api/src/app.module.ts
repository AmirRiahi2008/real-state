import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './audit/audit.module';
import { InfraModule } from './infra/infra.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { RateLimitGuard } from './common/rate-limit.guard';
import { CatalogModule } from './catalog/catalog.module';
import { ContentModule } from './content/content.module';
import { UsersModule } from './users/users.module';
import { ListingsModule } from './listings/listings.module';
import { ProjectsModule } from './projects/projects.module';
import { LeadsModule } from './leads/leads.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { CalculatorsModule } from './calculators/calculators.module';
import { HealthModule } from './health/health.module';
import { MediaModule } from './media/media.module';
import { TeamModule } from './team/team.module';
import { AdminModule } from './admin/admin.module';
import { SiteContentModule } from './site-content/site-content.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', 'apps/api/.env'],
      validate: validateEnvironment,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    InfraModule,
    AuthModule,
    CatalogModule,
    ContentModule,
    UsersModule,
    ListingsModule,
    ProjectsModule,
    LeadsModule,
    WorkspaceModule,
    CalculatorsModule,
    HealthModule,
    MediaModule,
    TeamModule,
    SiteContentModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
