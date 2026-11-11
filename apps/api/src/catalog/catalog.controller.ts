import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import {
  AreaQueryDto,
  CatalogQueryDto,
  CreateAgentProfileDto,
  CreateAmenityDto,
  CreateAreaDto,
  CreateDeveloperDto,
  UpdateAgentProfileDto,
  UpdateAmenityDto,
  UpdateAreaDto,
  UpdateDeveloperDto,
} from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}
  @Public() @Get('areas') areas(@Query() query: AreaQueryDto) {
    return this.catalog.areas(query);
  }
  @Public() @Get('areas/:slug') area(@Param('slug') slug: string) {
    return this.catalog.area(slug);
  }
  @Public() @Get('developers') developers(@Query() query: CatalogQueryDto) {
    return this.catalog.developers(query);
  }
  @Public() @Get('developers/:slug') developer(@Param('slug') slug: string) {
    return this.catalog.developer(slug);
  }
  @Public() @Get('amenities') amenities(@Query() query: CatalogQueryDto) {
    return this.catalog.amenities(query);
  }
  @Public() @Get('agents') agents(@Query() query: CatalogQueryDto) {
    return this.catalog.agents(query);
  }
  @Public() @Get('agents/:slug') agent(@Param('slug') slug: string) {
    return this.catalog.agent(slug);
  }
  @Public() @Get('catalog/autocomplete') autocomplete(@Query() query: CatalogQueryDto) {
    return this.catalog.autocomplete(query);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Post('areas/manage') createArea(
    @Body() dto: CreateAreaDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.catalog.createArea(dto, actor);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Patch('areas/manage/:id') updateArea(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAreaDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.catalog.updateArea(id, dto, actor);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Post('developers/manage') createDeveloper(
    @Body() dto: CreateDeveloperDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.catalog.createDeveloper(dto, actor);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Patch('developers/manage/:id') updateDeveloper(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeveloperDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.catalog.updateDeveloper(id, dto, actor);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Post('amenities/manage') createAmenity(
    @Body() dto: CreateAmenityDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.catalog.createAmenity(dto, actor);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Patch('amenities/manage/:id') updateAmenity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAmenityDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.catalog.updateAmenity(id, dto, actor);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Post('agents/manage') createAgent(
    @Body() dto: CreateAgentProfileDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.catalog.createAgent(dto, actor);
  }
  @ApiBearerAuth() @Roles(Role.ADMIN) @Patch('agents/manage/:id') updateAgent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentProfileDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.catalog.updateAgent(id, dto, actor);
  }
}
