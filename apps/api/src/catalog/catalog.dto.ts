import { Transform } from 'class-transformer';
import { OmitType, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Emirate } from '@prisma/client';
import { PaginationDto } from '../common/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const plainText = /^[^<>]*$/u;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CatalogQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 100) q?: string;
}
export class AreaQueryDto extends CatalogQueryDto {
  @IsOptional() @IsEnum(Emirate) emirate?: Emirate;
}
export class CreateAreaDto {
  @Transform(trim) @IsString() @Length(2, 120) @Matches(slugPattern) slug: string;
  @Transform(trim) @IsString() @Length(2, 160) @Matches(plainText) nameEn: string;
  @Transform(trim) @IsString() @Length(2, 160) @Matches(plainText) nameAr: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(15000)
  @Matches(plainText)
  descriptionEn?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(15000)
  @Matches(plainText)
  descriptionAr?: string;
  @IsEnum(Emirate) emirate: Emirate;
  @IsOptional() @IsLatitude() latitude?: string | null;
  @IsOptional() @IsLongitude() longitude?: string | null;
  @IsOptional() @IsUUID('4') parentId?: string | null;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsBoolean() isActive?: boolean;
}
export class UpdateAreaDto extends PartialType(CreateAreaDto, { skipNullProperties: false }) {}
export class CreateDeveloperDto {
  @Transform(trim) @IsString() @Length(2, 120) @Matches(slugPattern) slug: string;
  @Transform(trim) @IsString() @Length(2, 160) @Matches(plainText) nameEn: string;
  @Transform(trim) @IsString() @Length(2, 160) @Matches(plainText) nameAr: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(15000)
  @Matches(plainText)
  descriptionEn?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(15000)
  @Matches(plainText)
  descriptionAr?: string;
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true, disallow_auth: true })
  @MaxLength(500)
  website?: string | null;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsBoolean() isActive?: boolean;
}
export class UpdateDeveloperDto extends PartialType(CreateDeveloperDto, {
  skipNullProperties: false,
}) {}
export class CreateAmenityDto {
  @Transform(trim) @IsString() @Length(2, 80) @Matches(slugPattern) slug: string;
  @Transform(trim) @IsString() @Length(2, 120) @Matches(plainText) nameEn: string;
  @Transform(trim) @IsString() @Length(2, 120) @Matches(plainText) nameAr: string;
}
export class UpdateAmenityDto extends PartialType(CreateAmenityDto, {
  skipNullProperties: false,
}) {}
export class CreateAgentProfileDto {
  @IsUUID('4') userId: string;
  @Transform(trim) @IsString() @Length(2, 120) @Matches(slugPattern) slug: string;
  @Transform(trim) @IsString() @Length(2, 160) @Matches(plainText) displayName: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  @Matches(plainText)
  bioEn?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  @Matches(plainText)
  bioAr?: string;
  @IsOptional() @Transform(trim) @IsEmail() @MaxLength(254) publicEmail?: string | null;
  @IsOptional() @Matches(/^\+[1-9]\d{7,14}$/) phone?: string | null;
  @IsOptional() @Matches(/^\+[1-9]\d{7,14}$/) whatsapp?: string | null;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  @Matches(/^[a-zA-Z0-9 -]+$/)
  reraNumber?: string | null;
  @IsArray()
  @ArrayMaxSize(12)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(2, 40, { each: true })
  @Matches(/^[\p{L} -]+$/u, { each: true })
  languages: string[];
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsUUID('4') areaId?: string | null;
  @IsOptional() @IsUUID('4') photoMediaId?: string | null;
}
export class UpdateAgentProfileDto extends PartialType(
  OmitType(CreateAgentProfileDto, ['userId'] as const),
  { skipNullProperties: false },
) {}
