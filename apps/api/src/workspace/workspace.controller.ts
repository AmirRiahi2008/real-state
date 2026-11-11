import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators';
import { PaginationDto } from '../common/pagination.dto';
import { RateLimit } from '../common/rate-limit.decorator';
import { CreateSavedSearchDto, UpdateSavedSearchDto } from './workspace.dto';
import { WorkspaceService } from './workspace.service';

@ApiTags('My workspace')
@ApiBearerAuth()
@Controller('me')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}
  @Get('favorites')
  @ApiOperation({ summary: 'List my favorites that are still publicly visible' })
  favorites(@CurrentUser() actor: AuthUser, @Query() query: PaginationDto) {
    return this.workspace.favorites(actor, query);
  }
  @Put('favorites/:listingId')
  @HttpCode(204)
  @RateLimit(30)
  addFavorite(
    @CurrentUser() actor: AuthUser,
    @Param('listingId', new ParseUUIDPipe({ version: '4' })) listingId: string,
  ) {
    return this.workspace.addFavorite(actor, listingId);
  }
  @Delete('favorites/:listingId')
  @HttpCode(204)
  removeFavorite(
    @CurrentUser() actor: AuthUser,
    @Param('listingId', new ParseUUIDPipe({ version: '4' })) listingId: string,
  ) {
    return this.workspace.removeFavorite(actor, listingId);
  }
  @Delete('favorites')
  @HttpCode(204)
  @ApiOperation({ summary: 'Clear all my favorites, including unavailable listings' })
  clearFavorites(@CurrentUser() actor: AuthUser) {
    return this.workspace.clearFavorites(actor);
  }
  @Get('saved-searches') savedSearches(
    @CurrentUser() actor: AuthUser,
    @Query() query: PaginationDto,
  ) {
    return this.workspace.savedSearches(actor, query);
  }
  @Post('saved-searches')
  @RateLimit(20)
  createSearch(@CurrentUser() actor: AuthUser, @Body() dto: CreateSavedSearchDto) {
    return this.workspace.createSearch(actor, dto);
  }
  @Get('saved-searches/:id/listings')
  savedResults(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.workspace.savedResults(actor, id, query);
  }
  @Get('saved-searches/:id')
  savedSearch(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.workspace.savedSearch(actor, id);
  }
  @Patch('saved-searches/:id')
  updateSearch(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSavedSearchDto,
  ) {
    return this.workspace.updateSearch(actor, id, dto);
  }
  @Delete('saved-searches/:id')
  @HttpCode(204)
  removeSearch(
    @CurrentUser() actor: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.workspace.removeSearch(actor, id);
  }
}
