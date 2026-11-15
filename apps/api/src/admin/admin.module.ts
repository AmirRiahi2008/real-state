import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SiteContentModule } from '../site-content/site-content.module';
import { TeamModule } from '../team/team.module';
import { AdminController } from './admin.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminTeamService } from './admin-team.service';
import { AdminUsersService } from './admin-users.service';
import { AdminVerifiedGuard } from './admin-verified.guard';
@Module({
  imports: [AuthModule, TeamModule, SiteContentModule],
  controllers: [AdminController],
  providers: [
    AdminAnalyticsService,
    AdminCatalogService,
    AdminTeamService,
    AdminUsersService,
    AdminVerifiedGuard,
  ],
})
export class AdminModule {}
