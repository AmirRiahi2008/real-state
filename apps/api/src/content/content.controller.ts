import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PublicationStatus, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import {
  ContentQueryDto,
  ContentTransitionDto,
  CreateContentDto,
  UpdateContentDto,
} from './content.dto';
import { ContentService } from './content.service';

@ApiTags('Content')
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}
  @Public() @Get() list(@Query() query: ContentQueryDto) {
    return this.content.list(query);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Get('manage') manage(@Query() query: ContentQueryDto) {
    return this.content.list(query, false);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Get('manage/:id') managed(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.content.managed(id);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Post('manage') create(
    @Body() dto: CreateContentDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.content.create(dto, actor);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Patch('manage/:id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContentDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.content.update(id, dto, actor);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Post('manage/:id/publish') publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContentTransitionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.content.transition(id, dto, PublicationStatus.PUBLISHED, actor);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Post('manage/:id/archive') archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContentTransitionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.content.transition(id, dto, PublicationStatus.ARCHIVED, actor);
  }
  @Public() @Get(':slug') detail(@Param('slug') slug: string) {
    return this.content.detail(slug);
  }
}
