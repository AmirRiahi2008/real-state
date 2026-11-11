import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import { MortgageDto, RentalYieldDto } from './calculators.dto';
import { CalculatorsService } from './calculators.service';
@ApiTags('Calculators')
@Public()
@Controller('calculators')
export class CalculatorsController {
  constructor(private readonly calculators: CalculatorsService) {}
  @Get('mortgage')
  @ApiOperation({
    summary:
      'Illustrative fixed-rate monthly mortgage calculation; AED outputs are decimal strings',
  })
  mortgage(@Query() input: MortgageDto) {
    return this.calculators.mortgage(input);
  }
  @Get('rental-yield')
  @ApiOperation({ summary: 'Gross and net annual rental yield using supplied costs' })
  rentalYield(@Query() input: RentalYieldDto) {
    return this.calculators.rentalYield(input);
  }
}
