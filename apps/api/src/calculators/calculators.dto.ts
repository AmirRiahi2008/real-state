import { Type } from 'class-transformer';
import { IsInt, IsNumber, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class MortgageDto {
  @ApiProperty({ minimum: 1, maximum: 1000000000, example: 2000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000000000)
  priceAed!: number;
  @ApiProperty({ minimum: 0, maximum: 100, example: 25 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  downPaymentPercent!: number;
  @ApiProperty({ minimum: 0, maximum: 30, example: 4 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(30)
  annualInterestRate!: number;
  @ApiProperty({ minimum: 1, maximum: 30, example: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  years!: number;
}
export class RentalYieldDto {
  @ApiProperty({ minimum: 1, maximum: 1000000000, example: 2000000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(1000000000)
  priceAed!: number;
  @ApiProperty({ minimum: 0, maximum: 1000000000, example: 150000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000)
  annualRentAed!: number;
  @ApiProperty({ minimum: 0, maximum: 1000000000, example: 20000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000)
  annualCostsAed!: number;
}
