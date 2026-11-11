import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  Availability,
  CompletionStatus,
  Emirate,
  Furnishing,
  ListingPurpose,
  PropertyType,
} from '@prisma/client';
import { PaginationDto } from '../../common/pagination.dto';

export enum ListingSort {
  RECENT = 'recent',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  AREA_ASC = 'area_asc',
  AREA_DESC = 'area_desc',
}
export const decimalPattern = /^\d{1,14}(?:\.\d{1,2})?$/;
export const commaSeparated = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.split(',').filter(Boolean) : value;
export const queryBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

/** Only this allowlisted query object may be persisted as saved-search filters. */
export class SearchListingsDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional({ enum: ListingPurpose })
  @IsOptional()
  @IsEnum(ListingPurpose)
  purpose?: ListingPurpose;
  @ApiPropertyOptional({ enum: PropertyType })
  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;
  @ApiPropertyOptional({ enum: Emirate }) @IsOptional() @IsEnum(Emirate) emirate?: Emirate;
  @ApiPropertyOptional({ enum: CompletionStatus })
  @IsOptional()
  @IsEnum(CompletionStatus)
  completion?: CompletionStatus;
  @ApiPropertyOptional({ enum: Availability })
  @IsOptional()
  @IsEnum(Availability)
  availability?: Availability;
  @ApiPropertyOptional({ enum: Furnishing })
  @IsOptional()
  @IsEnum(Furnishing)
  furnishing?: Furnishing;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(commaSeparated)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  areaIds?: string[];
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(commaSeparated)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  amenityIds?: string[];
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') projectId?: string;
  @ApiPropertyOptional({ description: 'Public agent profile ID returned by /agents.' })
  @IsOptional()
  @IsUUID('4')
  agentId?: string;
  @ApiPropertyOptional({ example: '1000000.00', description: 'AED decimal string' })
  @IsOptional()
  @Matches(decimalPattern)
  minPrice?: string;
  @ApiPropertyOptional({ example: '5000000.00' })
  @IsOptional()
  @Matches(decimalPattern)
  maxPrice?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(decimalPattern) minAreaSqm?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(decimalPattern) maxAreaSqm?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  bedrooms?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  minBathrooms?: number;
  @ApiPropertyOptional() @IsOptional() @Transform(queryBoolean) @IsBoolean() isExclusive?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  priceOnRequest?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(queryBoolean) @IsBoolean() reducedPrice?: boolean;
  @ApiPropertyOptional({ example: '2027-12-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  vacantBy?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  south?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  north?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  west?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  east?: number;
  @ApiPropertyOptional({ enum: ListingSort, default: ListingSort.RECENT })
  @IsOptional()
  @IsEnum(ListingSort)
  sort: ListingSort = ListingSort.RECENT;
}
