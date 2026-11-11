import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EmailDto {
  @ApiProperty({ example: 'customer@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email: string;
}

export class RegisterDto extends EmailDto {
  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 80)
  firstName: string;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 80)
  lastName: string;
}

export class LoginDto extends EmailDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  password: string;
}

export class TokenDto {
  @ApiProperty({ description: 'Single-use token from the email link' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  currentPassword: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  newPassword: string;
}
