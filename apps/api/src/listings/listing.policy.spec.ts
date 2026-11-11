import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Availability, CompletionStatus, ListingPurpose, PropertyType, Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthUser } from '../auth/auth-user';
import { MediaAttachmentDto, UpdateListingDto } from './dto/listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import {
  assertListingOwner,
  ListingFacts,
  validateListingFacts,
  validateListingInputNulls,
  validateMediaAttachments,
  validateSearchRanges,
} from './listing.policy';
import { buildListingWhere, publicListingSelect, publicListingWhere } from './listings.repository';

const facts = (): ListingFacts => ({
  purpose: ListingPurpose.SALE,
  propertyType: PropertyType.APARTMENT,
  completion: CompletionStatus.READY,
  availability: Availability.AVAILABLE,
  priceOnRequest: false,
  priceAed: '1500000.00',
  areaSqm: '125.00',
  bedrooms: 2,
});
const user = {
  id: 'agent-a',
  email: 'a@example.test',
  role: Role.AGENT,
  sessionId: 'session-a',
} as AuthUser;
describe('Listing security and business policy', () => {
  it('conceals another agent’s inventory', () =>
    expect(() => assertListingOwner('agent-b', user)).toThrow(NotFoundException));
  it('allows an administrator to moderate another owner', () =>
    expect(() => assertListingOwner('agent-b', { ...user, role: Role.ADMIN })).not.toThrow());
  it('requires positive money or explicit price-on-request', () => {
    expect(() => validateListingFacts({ ...facts(), priceAed: null })).toThrow(BadRequestException);
    expect(() => validateListingFacts({ ...facts(), priceOnRequest: true })).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateListingFacts({ ...facts(), priceAed: null, priceOnRequest: true }),
    ).not.toThrow();
  });
  it('rejects zero/negative area', () =>
    expect(() => validateListingFacts({ ...facts(), areaSqm: '0' })).toThrow(BadRequestException));
  it('requires a rental period only for rentals', () => {
    expect(() => validateListingFacts({ ...facts(), purpose: ListingPurpose.RENT })).toThrow(
      BadRequestException,
    );
    expect(() => validateListingFacts({ ...facts(), rentalPeriod: 'YEAR' })).toThrow(
      BadRequestException,
    );
    expect(() =>
      validateListingFacts({ ...facts(), purpose: ListingPurpose.RENT, rentalPeriod: 'YEAR' }),
    ).not.toThrow();
  });
  it('rejects contradictory sale/rental availability', () =>
    expect(() => validateListingFacts({ ...facts(), availability: Availability.RENTED })).toThrow(
      BadRequestException,
    ));
  it('rejects contradictory studio bedrooms', () =>
    expect(() => validateListingFacts({ ...facts(), propertyType: PropertyType.STUDIO })).toThrow(
      BadRequestException,
    ));
  it('requires an off-plan handover estimate', () =>
    expect(() =>
      validateListingFacts({ ...facts(), completion: CompletionStatus.OFF_PLAN }),
    ).toThrow(BadRequestException));
  it('requires paired coordinates in valid ranges', () => {
    expect(() => validateListingFacts({ ...facts(), latitude: '25' })).toThrow(BadRequestException);
    expect(() => validateListingFacts({ ...facts(), latitude: '95', longitude: '55' })).toThrow(
      BadRequestException,
    );
  });
  it('requires actual reductions for previous price', () =>
    expect(() => validateListingFacts({ ...facts(), previousPriceAed: '1400000' })).toThrow(
      BadRequestException,
    ));
  it('rejects duplicate media and positions', () =>
    expect(() =>
      validateMediaAttachments([
        { mediaId: 'a', position: 0, altEn: '', altAr: '' },
        { mediaId: 'b', position: 0, altEn: '', altAr: '' },
      ]),
    ).toThrow(BadRequestException));
  it('rejects null collections instead of bypassing nested DTO validation', () =>
    expect(() => validateListingInputNulls({ media: null })).toThrow(BadRequestException));
  it('requires complete, ordered bounding boxes', () => {
    expect(() =>
      validateSearchRanges(Object.assign(new SearchListingsDto(), { south: 24 })),
    ).toThrow(BadRequestException);
    expect(() =>
      validateSearchRanges(
        Object.assign(new SearchListingsDto(), { south: 26, north: 24, west: 54, east: 55 }),
      ),
    ).toThrow(BadRequestException);
  });
  it('compares decimal ranges exactly', () =>
    expect(() =>
      validateSearchRanges(
        Object.assign(new SearchListingsDto(), {
          minPrice: '99999999999999.99',
          maxPrice: '99999999999999.98',
        }),
      ),
    ).toThrow(BadRequestException));
  it('always combines user filters with the public publication scope', () => {
    const where = buildListingWhere(
      Object.assign(new SearchListingsDto(), { q: 'home', amenityIds: ['a', 'b'] }),
    );
    expect(where.AND).toEqual(
      expect.arrayContaining([
        publicListingWhere,
        { amenities: { some: { amenityId: 'a' } } },
        { amenities: { some: { amenityId: 'b' } } },
      ]),
    );
    expect(publicListingWhere.status).toBe('PUBLISHED');
  });
  it('never projects authentication fields or storage keys publicly', () => {
    const projection = JSON.stringify(publicListingSelect);
    expect(projection).not.toContain('passwordHash');
    expect(projection).not.toContain('storageKey');
    expect(projection).not.toContain('sessions');
    expect(projection).not.toContain('"email"');
    expect(projection).not.toContain('userId');
  });
  it('filters inventory using the same public profile identity exposed by the agent catalog', () => {
    const where = buildListingWhere(
      Object.assign(new SearchListingsDto(), { agentId: 'public-profile-id' }),
    );
    expect(where.AND).toEqual(
      expect.arrayContaining([{ agent: { agentProfile: { is: { id: 'public-profile-id' } } } }]),
    );
    expect(publicListingWhere.agent).toMatchObject({
      agentProfile: {
        is: { isPublic: true, OR: [{ areaId: null }, { area: { isActive: true } }] },
      },
    });
  });
  it.each([
    'https://trakheesi.dubailand.gov.ae.attacker.test/permit',
    'https://trakheesi.dubailand.gov.ae@attacker.test/permit',
    'https://name:secret@trakheesi.dubailand.gov.ae/permit',
    'https://trakheesi.dubailand.gov.ae/permit\nhttps://attacker.test',
    'javascript:alert(1)',
  ])('rejects unsafe permit links: %s', async (permitUrl) => {
    const dto = plainToInstance(UpdateListingDto, { version: 1, permitUrl });
    expect((await validate(dto)).some((error) => error.property === 'permitUrl')).toBe(true);
  });
  it('accepts a supplied permit link only on the HTTPS official portal', async () => {
    const dto = plainToInstance(UpdateListingDto, {
      version: 1,
      permitUrl: 'https://trakheesi.dubailand.gov.ae/permit?id=123',
    });
    expect(await validate(dto)).toHaveLength(0);
  });
  it('rejects null media captions and HTML in bilingual plain-text fields', async () => {
    const media = plainToInstance(MediaAttachmentDto, {
      mediaId: '2d4c9d45-7671-4c4d-810a-1f143742d8d4',
      position: 0,
      altEn: null,
    });
    expect((await validate(media)).some((error) => error.property === 'altEn')).toBe(true);
    const dto = plainToInstance(UpdateListingDto, {
      version: 1,
      titleAr: '<img src=x onerror=alert(1)>',
      descriptionEn: '<script>alert(1)</script>',
    });
    expect((await validate(dto)).map((error) => error.property)).toEqual(
      expect.arrayContaining(['titleAr', 'descriptionEn']),
    );
  });
});
