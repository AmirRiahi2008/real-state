import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma } from '@prisma/client';
import { SearchListingsDto } from '../listings/dto/search-listings.dto';
import { validateSearchRanges } from '../listings/listing.policy';

export function validateSavedFilters(value: unknown): SearchListingsDto {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new BadRequestException('Saved filters must be an object');
  if (
    Object.keys(value).length > 30 ||
    Object.keys(value).some((key) => ['__proto__', 'prototype', 'constructor'].includes(key)) ||
    Object.values(value).some((item) => item === null)
  )
    throw new BadRequestException('Invalid saved filters');
  const filter = plainToInstance(SearchListingsDto, value);
  const errors = validateSync(filter, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
  });
  if (errors.length)
    throw new BadRequestException('Saved filters contain unsupported fields or invalid values');
  validateSearchRanges(filter);
  return filter;
}
export function serializeSavedFilters(value: unknown): Prisma.InputJsonObject {
  const filters = validateSavedFilters(value);
  // Serialize the validated DTO, not user-supplied JSON or an arbitrary Prisma where.
  return JSON.parse(JSON.stringify(filters)) as Prisma.InputJsonObject;
}
