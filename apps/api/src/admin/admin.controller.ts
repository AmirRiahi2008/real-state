import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Roles } from '../auth/decorators';
import { RateLimit } from '../common/rate-limit.decorator';
import { PaginationDto } from '../common/pagination.dto';
import { ConversationMessageDto, TeamMessageQueryDto } from '../team/team.dto';
import { TeamConversationsService } from '../team/team-conversations.service';
import { SiteContentService } from '../site-content/site-content.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminTeamService } from './admin-team.service';
import { AdminUsersService } from './admin-users.service';
import { AdminVerifiedGuard } from './admin-verified.guard';
import {
  AdminConversationQueryDto,
  AdminQueryDto,
  AdminResetPasswordDto,
  CreateAdminTeamDto,
  CreateAdminUserDto,
  OverviewQueryDto,
  UpdateAdminTeamDto,
  UpdateSiteContentDto,
} from './admin.dto';
@ApiTags('Administration')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@UseGuards(AdminVerifiedGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly analytics: AdminAnalyticsService,
    private readonly catalog: AdminCatalogService,
    private readonly team: AdminTeamService,
    private readonly users: AdminUsersService,
    private readonly conversations: TeamConversationsService,
    private readonly content: SiteContentService,
  ) {}
  @Get('session') @RateLimit(600, 60) session(@CurrentUser() actor: AuthUser) {
    return this.users.session(actor);
  }
  @Get('overview') overview(@Query() query: OverviewQueryDto) {
    return this.analytics.overview(query.days);
  }
  @Get('options') options() {
    return this.catalog.options();
  }
  @Get('catalog/:kind') collection(@Param('kind') kind: string, @Query() query: AdminQueryDto) {
    return this.catalog.catalog(kind, query);
  }
  @Get('catalog/:kind/:id') catalogOne(
    @Param('kind') kind: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.catalog.one(kind, id);
  }
  @Get('audit') audit(@Query() query: PaginationDto) {
    return this.analytics.audit(query);
  }
  @Post('users') @RateLimit(10, 60) createUser(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.create(dto, actor);
  }
  @Post('users/:id/password') @RateLimit(10, 60) resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.users.resetPassword(id, dto, actor);
  }
  @Get('team') profiles(@Query() query: AdminQueryDto) {
    return this.team.list(query);
  }
  @Get('team/:id') profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.team.one(id);
  }
  @Post('team') @RateLimit(10, 60) createProfile(
    @Body() dto: CreateAdminTeamDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.team.create(dto, actor);
  }
  @Patch('team/:id') @RateLimit(30, 60) updateProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminTeamDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.team.update(id, dto, actor);
  }
  @Get('conversations') inbox(
    @CurrentUser() actor: AuthUser,
    @Query() query: AdminConversationQueryDto,
  ) {
    return this.conversations.inbox(actor, query, true, { memberId: query.memberId, q: query.q });
  }
  @Get('conversations/:id') thread(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TeamMessageQueryDto,
  ) {
    return this.conversations.staffThread(actor, id, query, true);
  }
  @Post('conversations/:id/replies') @RateLimit(30, 60) reply(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConversationMessageDto,
  ) {
    return this.conversations.reply(actor, id, dto, true);
  }
  @Get('site-content') siteContent() {
    return this.content.managed();
  }
  @Patch('site-content') @RateLimit(20, 60) updateSiteContent(
    @Body() dto: UpdateSiteContentDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.content.update(dto, actor);
  }
}
