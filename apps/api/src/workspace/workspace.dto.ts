import { Transform } from 'class-transformer';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
export class CreateSavedSearchDto {
  @ApiProperty() @Transform(trim) @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @ApiProperty({
    type: 'object',
    description:
      'Only supported public listing query fields; money and area filters use decimal strings',
    additionalProperties: true,
  })
  @IsObject()
  filters!: Record<string, unknown>;
}
export class UpdateSavedSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
