import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Role } from '@prisma/client';
import { PaginationDto } from '../common/pagination.dto';
import { UpdateTeamProfileDto } from '../team/team.dto';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const label = /^[^<>\u0000-\u001f\u007f]+$/u;
export class AdminQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 100) q?: string;
}
export class OverviewQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @IsIn([7, 30, 90])
  days = 30;
}
export class AdminConversationQueryDto extends AdminQueryDto {
  @IsOptional() @IsUUID('4') memberId?: string;
}
export class CreateAdminUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
  @IsString() @Length(12, 128) password: string;
  @Transform(trim) @IsString() @Length(1, 80) @Matches(label) firstName: string;
  @Transform(trim) @IsString() @Length(1, 80) @Matches(label) lastName: string;
  @IsEnum(Role) role: Role;
  @ValidateIf((_o, value: unknown) => value !== undefined) @IsBoolean() isActive?: boolean;
}
export class AdminResetPasswordDto {
  @IsString() @Length(12, 128) newPassword: string;
}
export class CreateAdminTeamDto extends CreateAdminUserDto {
  @Transform(trim) @IsString() @Length(2, 120) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug: string;
  @Transform(trim) @IsString() @Length(1, 160) @Matches(label) displayName: string;
  @Transform(trim) @IsString() @Length(1, 80) @Matches(label) titleEn: string;
  @Transform(trim) @IsString() @Length(1, 80) @Matches(label) titleAr: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @Matches(/^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u)
  bioEn?: string;
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @Matches(/^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u)
  bioAr?: string;
  @IsOptional() @IsUUID('4') avatarMediaId?: string | null;
  @ValidateIf((_o, value: unknown) => value !== undefined) @IsBoolean() isPublic?: boolean;
}
export class UpdateAdminTeamDto extends PartialType(UpdateTeamProfileDto, {
  skipNullProperties: false,
}) {
  @ValidateIf((_o, value: unknown) => value !== undefined) @IsBoolean() isPublic?: boolean;
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;
}
export class UpdateSiteContentDto {
  @IsInt() @Min(1) @Max(2147483646) expectedVersion: number;
  @IsObject() values: Record<string, { en: string; ar: string }>;
}
