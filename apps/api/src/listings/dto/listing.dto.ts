import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  Availability,
  CompletionStatus,
  Furnishing,
  ListingPurpose,
  PropertyType,
  RentalPeriod,
} from '@prisma/client';
import { decimalPattern } from './search-listings.dto';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const plainText = /^[^<>]*$/u;

export class MediaAttachmentDto {
  @ApiProperty() @IsUUID('4') mediaId: string;
  @ApiProperty({ minimum: 0, maximum: 29 }) @IsInt() @Min(0) @Max(29) position: number;
  @ApiPropertyOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(plainText)
  altEn = '';
  @ApiPropertyOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  @Matches(plainText)
  altAr = '';
}
export class CreateListingDto {
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
  titleEn: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Matches(plainText)
  titleAr: string;
  @ApiProperty({ description: 'Plain text; clients must not render raw HTML.' })
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  @Matches(plainText)
  descriptionEn: string;
  @ApiProperty({ description: 'Plain text; clients must not render raw HTML.' })
  @Transform(trim)
  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  @Matches(plainText)
  descriptionAr: string;
  @ApiProperty({ enum: ListingPurpose }) @IsEnum(ListingPurpose) purpose: ListingPurpose;
  @ApiProperty({ enum: PropertyType }) @IsEnum(PropertyType) propertyType: PropertyType;
  @ApiProperty({ enum: CompletionStatus }) @IsEnum(CompletionStatus) completion: CompletionStatus;
  @ApiPropertyOptional({ enum: Availability })
  @IsOptional()
  @IsEnum(Availability)
  availability?: Availability;
  @ApiPropertyOptional({ enum: Furnishing })
  @IsOptional()
  @IsEnum(Furnishing)
  furnishing?: Furnishing;
  @ApiPropertyOptional({ example: '1500000.00', nullable: true })
  @IsOptional()
  @Matches(decimalPattern)
  priceAed?: string | null;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() priceOnRequest?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(decimalPattern)
  previousPriceAed?: string | null;
  @ApiPropertyOptional({ enum: RentalPeriod, nullable: true })
  @IsOptional()
  @IsEnum(RentalPeriod)
  rentalPeriod?: RentalPeriod | null;
  @ApiProperty({ example: '125.50' }) @Matches(/^\d{1,10}(?:\.\d{1,2})?$/) areaSqm: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^\d{1,10}(?:\.\d{1,2})?$/)
  plotAreaSqm?: string | null;
  @ApiProperty() @IsInt() @Min(0) @Max(50) bedrooms: number;
  @ApiProperty() @IsInt() @Min(0) @Max(50) bathrooms: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100) parking?: number;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  @Matches(plainText)
  addressEn: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  @Matches(plainText)
  addressAr: string;
  @ApiPropertyOptional({ nullable: true, example: '25.204849' })
  @IsOptional()
  @Matches(/^-?\d{1,3}(?:\.\d{1,6})?$/)
  latitude?: string | null;
  @ApiPropertyOptional({ nullable: true, example: '55.270783' })
  @IsOptional()
  @Matches(/^-?\d{1,3}(?:\.\d{1,6})?$/)
  longitude?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  vacantOn?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  handoverDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isExclusive?: boolean;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(64) permitNumber?:
    string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Optional supplied DLD permit link; not independently verified by this API.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  @IsUrl({
    protocols: ['https'],
    require_protocol: true,
    host_whitelist: ['trakheesi.dubailand.gov.ae'],
    disallow_auth: true,
  })
  @Matches(/^https:\/\/trakheesi\.dubailand\.gov\.ae\/[^\s\\<>]*$/)
  permitUrl?: string | null;
  @ApiProperty() @IsUUID('4') areaId: string;
  @ApiPropertyOptional({ description: 'ADMIN only may assign another agent' })
  @IsOptional()
  @IsUUID('4')
  agentId?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsUUID('4') projectId?: string | null;
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
export class UpdateListingDto extends PartialType(CreateListingDto, { skipNullProperties: false }) {
  @ApiProperty({ description: 'Last observed version; stale writes return 409.' })
  @IsInt()
  @Min(1)
  version: number;
}
export class ListingTransitionDto {
  @ApiProperty() @IsInt() @Min(1) version: number;
}
