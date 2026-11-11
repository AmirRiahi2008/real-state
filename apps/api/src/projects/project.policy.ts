import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FloorPlanDto, PaymentMilestoneDto, SearchProjectsDto } from './dto/project.dto';

export interface ProjectFacts {
  startingPriceAed?: string | Prisma.Decimal | null;
  priceOnRequest: boolean;
  minBedrooms: number;
  maxBedrooms: number;
  latitude?: string | Prisma.Decimal | null;
  longitude?: string | Prisma.Decimal | null;
}
export function validateProjectFacts(facts: ProjectFacts): void {
  if (facts.minBedrooms > facts.maxBedrooms)
    throw new BadRequestException('Minimum bedrooms must not exceed maximum bedrooms');
  if (
    facts.priceOnRequest
      ? facts.startingPriceAed != null
      : facts.startingPriceAed == null ||
        new Prisma.Decimal(facts.startingPriceAed).lessThanOrEqualTo(0)
  )
    throw new BadRequestException(
      'Provide either a positive starting price or priceOnRequest without a price',
    );
  if ((facts.latitude == null) !== (facts.longitude == null))
    throw new BadRequestException('Coordinates must be supplied together');
  if (
    facts.latitude != null &&
    (new Prisma.Decimal(facts.latitude).abs().greaterThan(90) ||
      new Prisma.Decimal(facts.longitude!).abs().greaterThan(180))
  )
    throw new BadRequestException('Coordinates are out of range');
}
export function validatePaymentPlan(plan: PaymentMilestoneDto[]): void {
  if (
    plan.length &&
    !plan.reduce((sum, item) => sum.add(item.percentage), new Prisma.Decimal(0)).equals(100)
  )
    throw new BadRequestException('A complete payment plan must total exactly 100 percent');
}
export function validateFloorPlans(
  plans: FloorPlanDto[],
  minBedrooms: number,
  maxBedrooms: number,
): void {
  for (const plan of plans) {
    if (new Prisma.Decimal(plan.areaSqm).lessThanOrEqualTo(0))
      throw new BadRequestException('Floor-plan area must be positive');
    if (plan.bedrooms < minBedrooms || plan.bedrooms > maxBedrooms)
      throw new BadRequestException('Floor-plan bedrooms must match the project range');
  }
}
export function validateProjectSearch(query: SearchProjectsDto): void {
  if (Object.values(query).some((value) => value === null))
    throw new BadRequestException('Search values cannot be null');
  if (
    query.minPrice !== undefined &&
    query.maxPrice !== undefined &&
    new Prisma.Decimal(query.minPrice).greaterThan(query.maxPrice)
  )
    throw new BadRequestException('Minimum price must not exceed maximum price');
  if (query.priceOnRequest && (query.minPrice !== undefined || query.maxPrice !== undefined))
    throw new BadRequestException('Price-on-request cannot be combined with a price range');
  if (query.handoverFrom && query.handoverTo && query.handoverFrom > query.handoverTo)
    throw new BadRequestException('Handover dates are out of order');
}
export function validateProjectNulls(input: object): void {
  const nullable = new Set(['startingPriceAed', 'handoverDate', 'latitude', 'longitude']);
  if (Object.entries(input).some(([key, value]) => value === null && !nullable.has(key)))
    throw new BadRequestException('A required project value cannot be null');
}
