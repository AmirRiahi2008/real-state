import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const plainLabel = /^[^<>\u0000-\u001f\u007f]+$/u;
const safeBody = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u;

export class UpdateTeamProfileDto {
  @ApiPropertyOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 160)
  @Matches(plainLabel)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Public display title; never changes account permissions.' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  @Matches(plainLabel)
  titleEn?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  @Matches(plainLabel)
  titleAr?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @Matches(safeBody)
  bioEn?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  @Matches(safeBody)
  bioAr?: string;

  @ApiPropertyOptional({ nullable: true, description: 'An image owned by this account, or null.' })
  @IsOptional()
  @IsUUID('4')
  avatarMediaId?: string | null;
}

export class ConversationMessageDto {
  @ApiProperty({ maxLength: 3000 })
  @Transform(trim)
  @IsString()
  @Length(1, 3000)
  @Matches(safeBody)
  body: string;
}

export class CreateTeamConversationDto extends ConversationMessageDto {
  @ApiProperty()
  @IsUUID('4')
  memberId: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 160)
  @Matches(plainLabel)
  name: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ description: 'Consent to store this private conversation.', example: true })
  @IsBoolean()
  @Equals(true)
  consent: boolean;
}

export class TeamMessageQueryDto {
  @ApiPropertyOptional({ description: 'Load messages older than this message in the same thread.' })
  @IsOptional()
  @IsUUID('4')
  before?: string;
}
