import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthUser } from '../auth/auth-user';
import { paginated, PaginationDto } from '../common/pagination.dto';
import { presentListing } from '../listings/listings.repository';
import { ListingsService } from '../listings/listings.service';
import { serializeSavedFilters, validateSavedFilters } from './saved-search.policy';
import { CreateSavedSearchDto, UpdateSavedSearchDto } from './workspace.dto';
import { WorkspaceRepository } from './workspace.repository';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly listings: ListingsService,
  ) {}
  async favorites(actor: AuthUser, query: PaginationDto) {
    const { rows, total } = await this.repository.favorites(actor.id, query);
    return paginated(
      rows.map((row) => ({ savedAt: row.createdAt, listing: presentListing(row.listing) })),
      total,
      query.page,
      query.limit,
    );
  }
  addFavorite(actor: AuthUser, listingId: string) {
    return this.repository.addFavorite(actor.id, listingId);
  }
  removeFavorite(actor: AuthUser, listingId: string) {
    return this.repository.removeFavorite(actor.id, listingId);
  }
  clearFavorites(actor: AuthUser) {
    return this.repository.clearFavorites(actor.id);
  }
  async savedSearches(actor: AuthUser, query: PaginationDto) {
    const { rows, total } = await this.repository.savedSearches(actor.id, query);
    return paginated(rows, total, query.page, query.limit);
  }
  savedSearch(actor: AuthUser, id: string) {
    return this.repository.savedSearch(actor.id, id);
  }
  createSearch(actor: AuthUser, dto: CreateSavedSearchDto) {
    return this.repository.createSearch(actor.id, dto.name, serializeSavedFilters(dto.filters));
  }
  updateSearch(actor: AuthUser, id: string, dto: UpdateSavedSearchDto) {
    if (dto.name === null || dto.filters === null)
      throw new BadRequestException('Saved-search fields cannot be null');
    if (dto.name === undefined && dto.filters === undefined)
      throw new BadRequestException('Provide a name or filters');
    return this.repository.updateSearch(actor.id, id, {
      name: dto.name,
      filters: dto.filters === undefined ? undefined : serializeSavedFilters(dto.filters),
    });
  }
  removeSearch(actor: AuthUser, id: string) {
    return this.repository.removeSearch(actor.id, id);
  }
  async savedResults(actor: AuthUser, id: string, query: PaginationDto) {
    const saved = await this.repository.savedSearch(actor.id, id);
    const filters = validateSavedFilters(saved.filters);
    filters.page = query.page;
    filters.limit = query.limit;
    return this.listings.findAll(filters);
  }
}
