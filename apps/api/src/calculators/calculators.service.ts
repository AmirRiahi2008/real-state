import { BadRequestException, Injectable } from '@nestjs/common';
import { MortgageDto, RentalYieldDto } from './calculators.dto';

export function monthlyPayment(
  principal: number,
  annualInterestRate: number,
  years: number,
): number {
  if (
    ![principal, annualInterestRate, years].every(Number.isFinite) ||
    principal < 0 ||
    annualInterestRate < 0 ||
    annualInterestRate > 30 ||
    !Number.isInteger(years) ||
    years < 1 ||
    years > 30
  )
    throw new BadRequestException('Invalid amortization inputs');
  const payments = years * 12;
  if (annualInterestRate === 0) return principal / payments;
  const monthlyRate = annualInterestRate / 1200;
  // log1p/expm1 avoid cancellation and loss of precision at very small rates.
  return (principal * monthlyRate) / -Math.expm1(-payments * Math.log1p(monthlyRate));
}

@Injectable()
export class CalculatorsService {
  mortgage(input: MortgageDto) {
    const downPayment = (input.priceAed * input.downPaymentPercent) / 100;
    const principal = input.priceAed - downPayment;
    const monthly = monthlyPayment(principal, input.annualInterestRate, input.years);
    const payments = input.years * 12;
    return {
      currency: 'AED',
      priceAed: input.priceAed.toFixed(2),
      downPaymentAed: downPayment.toFixed(2),
      principalAed: principal.toFixed(2),
      monthlyPaymentAed: monthly.toFixed(2),
      totalRepaymentAed: (monthly * payments).toFixed(2),
      totalInterestAed: Math.max(0, monthly * payments - principal).toFixed(2),
      assumptions: {
        annualInterestRate: input.annualInterestRate,
        years: input.years,
        payments,
        type: 'fixed-rate monthly amortization',
        excludes: [
          'bank arrangement and valuation fees',
          'insurance',
          'transfer fees',
          'service charges',
        ],
      },
      disclaimer:
        'Illustrative estimate using your inputs. This is not a lending offer, eligibility assessment or guarantee of finance.',
    };
  }
  rentalYield(input: RentalYieldDto) {
    return {
      currency: 'AED',
      annualGrossIncomeAed: input.annualRentAed.toFixed(2),
      annualCostsAed: input.annualCostsAed.toFixed(2),
      annualNetIncomeAed: (input.annualRentAed - input.annualCostsAed).toFixed(2),
      grossYieldPercent: ((input.annualRentAed / input.priceAed) * 100).toFixed(2),
      netYieldPercent: (
        ((input.annualRentAed - input.annualCostsAed) / input.priceAed) *
        100
      ).toFixed(2),
      assumptions: {
        denominator: 'property purchase price',
        excludes: ['vacancy', 'finance costs', 'transaction costs', 'capital gains or losses'],
        costsNote: 'Include additional annual costs in annualCostsAed if you want them deducted.',
      },
      disclaimer: 'Input-based estimate only. Returns and future occupancy are not guaranteed.',
    };
  }
}
