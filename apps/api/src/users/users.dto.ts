import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../common/pagination.dto';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
export class UsersQueryDto extends PaginationDto {
  @IsOptional() @Transform(trim) @IsString() @Length(1, 100) q?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
}
export class UpdateUserAccessDto {
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsEnum(Role) role?: Role;
  @ValidateIf((_object, value: unknown) => value !== undefined) @IsBoolean() isActive?: boolean;
}
export class UpdateOwnProfileDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  @Matches(/^[^<>]*$/u)
  firstName?: string;
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  @Matches(/^[^<>]*$/u)
  lastName?: string;
}
