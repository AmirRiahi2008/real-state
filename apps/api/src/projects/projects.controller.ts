import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { PaginationDto } from '../common/pagination.dto';
import { RateLimit } from '../common/rate-limit.decorator';
import {
  CreateProjectDto,
  ProjectTransitionDto,
  SearchProjectsDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Off-plan projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}
  @Public()
  @Get()
  findAll(@Query() query: SearchProjectsDto) {
    return this.projects.findAll(query);
  }
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('manage')
  managedPage(@Query() query: PaginationDto, @CurrentUser() actor: AuthUser) {
    return this.projects.managedPage(query, actor);
  }
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('manage/:id')
  managedOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.projects.managedOne(id, actor);
  }
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @RateLimit(30)
  @Post('manage')
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: AuthUser) {
    return this.projects.create(dto, actor);
  }
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @RateLimit(30)
  @Patch('manage/:id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.projects.update(id, dto, actor);
  }
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('manage/:id/submit')
  submit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ProjectTransitionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.projects.transition(id, 'submit', dto, actor);
  }
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('manage/:id/publish')
  publish(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ProjectTransitionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.projects.transition(id, 'publish', dto, actor);
  }
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('manage/:id/reject')
  reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ProjectTransitionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.projects.transition(id, 'reject', dto, actor);
  }
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('manage/:id/archive')
  archive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ProjectTransitionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.projects.transition(id, 'archive', dto, actor);
  }
  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.projects.findOne(slug);
  }
}
