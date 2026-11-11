import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { PaginationDto } from '../common/pagination.dto';
import { RateLimit } from '../common/rate-limit.decorator';
import { CreateListingDto, ListingTransitionDto, UpdateListingDto } from './dto/listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { ListingsService } from './listings.service';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}
  @Public()
  @Get()
  @ApiOperation({ summary: 'Search published properties; AED money and canonical square metres' })
  findAll(@Query() query: SearchListingsDto) {
    return this.listings.findAll(query);
  }
  @ApiBearerAuth()
  @Roles(Role.AGENT, Role.ADMIN)
  @Get('manage/mine')
  mine(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.listings.mine(user, query);
  }
  @ApiBearerAuth()
  @Roles(Role.AGENT, Role.ADMIN)
  @Get('manage/:id')
  managedOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.managedOne(id, user);
  }
  @ApiBearerAuth()
  @Roles(Role.AGENT, Role.ADMIN)
  @RateLimit(30)
  @Post('manage')
  create(@Body() dto: CreateListingDto, @CurrentUser() user: AuthUser) {
    return this.listings.create(dto, user);
  }
  @ApiBearerAuth()
  @Roles(Role.AGENT, Role.ADMIN)
  @RateLimit(30)
  @Patch('manage/:id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateListingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.update(id, dto, user);
  }
  @ApiBearerAuth()
  @Roles(Role.AGENT, Role.ADMIN)
  @Post('manage/:id/submit')
  submit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ListingTransitionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.transition(id, 'submit', dto, user);
  }
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('manage/:id/publish')
  publish(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ListingTransitionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.transition(id, 'publish', dto, user);
  }
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('manage/:id/reject')
  reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ListingTransitionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.transition(id, 'reject', dto, user);
  }
  @ApiBearerAuth()
  @Roles(Role.AGENT, Role.ADMIN)
  @Post('manage/:id/archive')
  archive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ListingTransitionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.listings.transition(id, 'archive', dto, user);
  }
  @Public()
  @Get(':slug/related')
  related(@Param('slug') slug: string) {
    return this.listings.related(slug);
  }
  @Public()
  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.listings.findOne(slug);
  }
}
