import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Availability,
  CompletionStatus,
  ListingPurpose,
  Prisma,
  PropertyType,
  Role,
} from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { MediaAttachmentDto } from './dto/listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';

export function assertListingOwner(agentId: string, actor: AuthUser): void {
  if (actor.role !== Role.AGENT && actor.role !== Role.ADMIN)
    throw new NotFoundException('Listing not found');
  if (actor.role !== Role.ADMIN && agentId !== actor.id)
    throw new NotFoundException('Listing not found');
}
export function validateSearchRanges(query: SearchListingsDto): void {
  if (Object.values(query).some((value) => value === null))
    throw new BadRequestException('Search values cannot be null');
  for (const [min, max] of [
    [query.minPrice, query.maxPrice],
    [query.minAreaSqm, query.maxAreaSqm],
  ]) {
    if (min !== undefined && max !== undefined && new Prisma.Decimal(min).greaterThan(max))
      throw new BadRequestException('Minimum must not exceed maximum');
  }
  const box = [query.south, query.north, query.west, query.east];
  if (box.some((value) => value !== undefined)) {
    if (box.some((value) => value === undefined))
      throw new BadRequestException('A map bounding box requires south, north, west and east');
    if (query.south! >= query.north! || query.west! >= query.east!)
      throw new BadRequestException('Invalid map bounding box');
  }
  if (query.priceOnRequest && (query.minPrice !== undefined || query.maxPrice !== undefined))
    throw new BadRequestException('Price-on-request cannot be combined with a price range');
}
export function validateListingInputNulls(input: object): void {
  const nullable = new Set([
    'priceAed',
    'previousPriceAed',
    'rentalPeriod',
    'plotAreaSqm',
    'latitude',
    'longitude',
    'vacantOn',
    'handoverDate',
    'permitNumber',
    'permitUrl',
    'projectId',
  ]);
  if (Object.entries(input).some(([key, value]) => value === null && !nullable.has(key)))
    throw new BadRequestException('A required listing value cannot be null');
}
export function validateMediaAttachments(media: MediaAttachmentDto[]): void {
  if (
    new Set(media.map((item) => item.mediaId)).size !== media.length ||
    new Set(media.map((item) => item.position)).size !== media.length
  )
    throw new BadRequestException('Media and positions must be unique');
}
export interface ListingFacts {
  purpose: ListingPurpose;
  propertyType: PropertyType;
  completion: CompletionStatus;
  availability: Availability;
  priceOnRequest: boolean;
  priceAed: Prisma.Decimal | string | null;
  previousPriceAed?: Prisma.Decimal | string | null;
  areaSqm: Prisma.Decimal | string;
  plotAreaSqm?: Prisma.Decimal | string | null;
  rentalPeriod?: string | null;
  bedrooms: number;
  latitude?: Prisma.Decimal | string | null;
  longitude?: Prisma.Decimal | string | null;
  handoverDate?: Date | string | null;
}
export function validateListingFacts(facts: ListingFacts): void {
  if (
    facts.priceOnRequest
      ? facts.priceAed !== null && facts.priceAed !== undefined
      : facts.priceAed == null || new Prisma.Decimal(facts.priceAed).lessThanOrEqualTo(0)
  )
    throw new BadRequestException(
      'Provide either a positive AED price or priceOnRequest without a price',
    );
  if (
    new Prisma.Decimal(facts.areaSqm).lessThanOrEqualTo(0) ||
    (facts.plotAreaSqm != null && new Prisma.Decimal(facts.plotAreaSqm).lessThanOrEqualTo(0))
  )
    throw new BadRequestException('Area must be positive');
  if (
    facts.previousPriceAed != null &&
    (facts.priceAed == null ||
      new Prisma.Decimal(facts.previousPriceAed).lessThanOrEqualTo(facts.priceAed))
  )
    throw new BadRequestException('Previous price must exceed the current price');
  if (facts.purpose === ListingPurpose.RENT && !facts.rentalPeriod)
    throw new BadRequestException('Rent listings require a rental period');
  if (facts.purpose === ListingPurpose.SALE && facts.rentalPeriod != null)
    throw new BadRequestException('Sale listings cannot have a rental period');
  if (
    (facts.purpose === ListingPurpose.RENT && facts.availability === Availability.SOLD) ||
    (facts.purpose === ListingPurpose.SALE && facts.availability === Availability.RENTED)
  )
    throw new BadRequestException('Availability does not match listing purpose');
  if (facts.propertyType === PropertyType.STUDIO && facts.bedrooms !== 0)
    throw new BadRequestException('A studio has zero separate bedrooms');
  if ((facts.latitude == null) !== (facts.longitude == null))
    throw new BadRequestException('Latitude and longitude must be supplied together');
  if (
    facts.latitude != null &&
    (new Prisma.Decimal(facts.latitude).abs().greaterThan(90) ||
      new Prisma.Decimal(facts.longitude!).abs().greaterThan(180))
  )
    throw new BadRequestException('Coordinates are out of range');
  if (facts.completion === CompletionStatus.OFF_PLAN && !facts.handoverDate)
    throw new BadRequestException('Off-plan inventory requires an estimated handover date');
  if (
    facts.completion === CompletionStatus.READY &&
    facts.handoverDate &&
    new Date(facts.handoverDate) > new Date()
  )
    throw new BadRequestException('Ready inventory cannot have a future handover date');
}
