import type { RichDocument } from '@oriva/rich-content';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';
import { ContentType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.dto';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class ContentQueryDto extends PaginationDto {
  @IsOptional() @IsEnum(ContentType) type?: ContentType;
  @IsOptional() @IsUUID('4') areaId?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 100) q?: string;
}
/** Rich JSON is canonicalized server-side; legacy bodies remain plain text, never raw HTML. */
export class CreateContentDto {
  @Transform(trim) @IsString() @Length(2, 160) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug: string;
  @IsEnum(ContentType) type: ContentType;
  @Transform(trim) @IsString() @Length(2, 200) @Matches(/^[^<>]*$/u) titleEn: string;
  @Transform(trim) @IsString() @Length(2, 200) @Matches(/^[^<>]*$/u) titleAr: string;
  @Transform(trim) @IsString() @Length(2, 600) @Matches(/^[^<>]*$/u) excerptEn: string;
  @Transform(trim) @IsString() @Length(2, 600) @Matches(/^[^<>]*$/u) excerptAr: string;
  @ValidateIf(
    (object: CreateContentDto) => object.bodyRichEn === undefined || object.bodyRichEn === null,
  )
  @Transform(trim)
  @IsString()
  @Length(10, 100000)
  @Matches(/^[^<>]*$/u, { message: 'bodyEn must not contain HTML' })
  bodyEn: string;
  @IsOptional() @IsObject() bodyRichEn?: RichDocument | null;
  @ValidateIf(
    (object: CreateContentDto) => object.bodyRichAr === undefined || object.bodyRichAr === null,
  )
  @Transform(trim)
  @IsString()
  @Length(10, 100000)
  @Matches(/^[^<>]*$/u, { message: 'bodyAr must not contain HTML' })
  bodyAr: string;
  @IsOptional() @IsObject() bodyRichAr?: RichDocument | null;
  @IsOptional() @IsUUID('4') areaId?: string | null;
  @IsOptional() @IsUUID('4') coverMediaId?: string | null;
}
export class UpdateContentDto extends PartialType(CreateContentDto, { skipNullProperties: false }) {
  @IsInt() @Min(1) @Max(2147483646) version: number;
}
export class ContentTransitionDto {
  @IsInt() @Min(1) @Max(2147483646) version: number;
}
