import type { RichDocument } from '@oriva/rich-content';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Emirate, PropertyType } from '@prisma/client';
import { PaginationDto } from '../../common/pagination.dto';
import { MediaAttachmentDto } from '../../listings/dto/listing.dto';
import { decimalPattern, queryBoolean } from '../../listings/dto/search-listings.dto';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const plainText = /^[^<>]*$/u;

export enum ProjectSort {
  RECENT = 'recent',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  HANDOVER = 'handover',
}
export class SearchProjectsDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) q?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') developerId?: string;
  @ApiPropertyOptional({ enum: Emirate }) @IsOptional() @IsEnum(Emirate) emirate?: Emirate;
  @ApiPropertyOptional({ enum: PropertyType })
  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;
  @ApiPropertyOptional() @IsOptional() @Matches(decimalPattern) minPrice?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(decimalPattern) maxPrice?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  bedrooms?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  priceOnRequest?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  handoverFrom?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  handoverTo?: string;
  @ApiPropertyOptional({ enum: ProjectSort }) @IsOptional() @IsEnum(ProjectSort) sort: ProjectSort =
    ProjectSort.RECENT;
}
export class PaymentMilestoneDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(plainText)
  labelEn: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(plainText)
  labelAr: string;
  @ApiProperty({ minimum: 0.01, maximum: 100 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  percentage: number;
}
export class FloorPlanDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(plainText)
  nameEn: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @Matches(plainText)
  nameAr: string;
  @ApiProperty() @IsInt() @Min(0) @Max(50) bedrooms: number;
  @ApiProperty({ example: '150.00' }) @Matches(/^\d{1,10}(?:\.\d{1,2})?$/) areaSqm: string;
}
export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Matches(plainText)
  nameEn: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Matches(plainText)
  nameAr: string;
  @ApiProperty({ description: 'Plain text; clients must not render raw HTML.' })
  @ValidateIf(
    (object: CreateProjectDto) =>
      object.descriptionRichEn === undefined || object.descriptionRichEn === null,
  )
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  @Matches(plainText)
  descriptionEn: string;
  @IsOptional() @IsObject() descriptionRichEn?: RichDocument | null;
  @ApiProperty({ description: 'Plain text; clients must not render raw HTML.' })
  @ValidateIf(
    (object: CreateProjectDto) =>
      object.descriptionRichAr === undefined || object.descriptionRichAr === null,
  )
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  @Matches(plainText)
  descriptionAr: string;
  @IsOptional() @IsObject() descriptionRichAr?: RichDocument | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(decimalPattern)
  startingPriceAed?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() priceOnRequest?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  handoverDate?: string | null;
  @ApiProperty() @IsInt() @Min(0) @Max(50) minBedrooms: number;
  @ApiProperty() @IsInt() @Min(0) @Max(50) maxBedrooms: number;
  @ApiProperty({ enum: PropertyType, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsEnum(PropertyType, { each: true })
  propertyTypes: PropertyType[];
  @ApiPropertyOptional({
    type: [PaymentMilestoneDto],
    description: 'If supplied, the complete payment plan must total exactly 100%.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PaymentMilestoneDto)
  paymentPlan?: PaymentMilestoneDto[];
  @ApiPropertyOptional({ type: [FloorPlanDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FloorPlanDto)
  floorPlans?: FloorPlanDto[];
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^-?\d{1,3}(?:\.\d{1,6})?$/)
  latitude?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^-?\d{1,3}(?:\.\d{1,6})?$/)
  longitude?: string | null;
  @ApiProperty() @IsUUID('4') developerId: string;
  @ApiProperty() @IsUUID('4') areaId: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  amenityIds?: string[];
  @ApiPropertyOptional({ type: [MediaAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => MediaAttachmentDto)
  media?: MediaAttachmentDto[];
}
export class UpdateProjectDto extends PartialType(CreateProjectDto, { skipNullProperties: false }) {
  @ApiProperty() @IsInt() @Min(1) version: number;
}
export class ProjectTransitionDto {
  @ApiProperty() @IsInt() @Min(1) version: number;
}
