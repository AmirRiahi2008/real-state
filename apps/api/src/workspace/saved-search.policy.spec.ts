import { BadRequestException } from '@nestjs/common';
import { ListingPurpose } from '@prisma/client';
import { serializeSavedFilters, validateSavedFilters } from './saved-search.policy';
describe('saved-search boundaries', () => {
  it('uses the same bounded, typed public query DTO', () => {
    const dto = validateSavedFilters({
      purpose: ListingPurpose.SALE,
      bedrooms: '2',
      isExclusive: 'true',
      minPrice: '1000000.00',
      maxPrice: '2000000.00',
    });
    expect(dto.bedrooms).toBe(2);
    expect(dto.isExclusive).toBe(true);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });
  it('rejects arbitrary database predicates and user/publication fields', () => {
    for (const filters of [
      { where: { status: 'DRAFT' } },
      { status: 'DRAFT' },
      { userId: 'someone-else' },
      { limit: 5000 },
      { q: { contains: 'x' } },
    ])
      expect(() => validateSavedFilters(filters)).toThrow(BadRequestException);
  });
  it('rejects invalid range combinations and incomplete map boxes', () => {
    expect(() => validateSavedFilters({ minPrice: '2000', maxPrice: '1000' })).toThrow(
      BadRequestException,
    );
    expect(() => validateSavedFilters({ south: 24, north: 26 })).toThrow(BadRequestException);
    expect(() => validateSavedFilters({ bedrooms: null })).toThrow(BadRequestException);
  });
  it('stores validated JSON values, never a live query object', () => {
    const input = { bedrooms: 2 };
    const result = serializeSavedFilters(input);
    input.bedrooms = 3;
    expect(result.bedrooms).toBe(2);
  });
});
