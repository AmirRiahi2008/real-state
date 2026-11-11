import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus, LeadType } from '@prisma/client';
import { PaginationDto } from '../common/pagination.dto';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateLeadDto {
  @ApiProperty({ enum: LeadType }) @IsEnum(LeadType) type!: LeadType;
  @ApiProperty() @Transform(trim) @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @ApiProperty() @Transform(normalizeEmail) @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty({ example: '+971501234567' })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/)
  phone!: string;
  @ApiProperty() @Transform(trim) @IsString() @MinLength(10) @MaxLength(3000) message!: string;
  @ApiProperty() @IsBoolean() @Equals(true) consent!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') listingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') projectId?: string;
  @ApiPropertyOptional({ example: '2027-01-10T10:00:00Z' })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  preferredAt?: string;
}

export class LeadQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LeadStatus }) @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @ApiPropertyOptional({ enum: LeadType }) @IsOptional() @IsEnum(LeadType) type?: LeadType;
}

export class UpdateLeadDto {
  @ApiPropertyOptional({ enum: LeadStatus }) @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  internalNotes?: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Administrators only; null clears assignment',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsUUID('4')
  assignedToId?: string | null;
}
