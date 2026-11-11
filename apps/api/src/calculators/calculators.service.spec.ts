import { BadRequestException } from '@nestjs/common';
import { CalculatorsService, monthlyPayment } from './calculators.service';
describe('financing calculations', () => {
  const service = new CalculatorsService();
  it('handles a zero interest loan without division by zero', () => {
    const result = service.mortgage({
      priceAed: 120000,
      downPaymentPercent: 0,
      annualInterestRate: 0,
      years: 10,
    });
    expect(result.monthlyPaymentAed).toBe('1000.00');
    expect(result.totalInterestAed).toBe('0.00');
  });
  it('amortizes a 4% loan and reports the purchase deposit separately', () => {
    const result = service.mortgage({
      priceAed: 1000000,
      downPaymentPercent: 20,
      annualInterestRate: 4,
      years: 25,
    });
    expect(result.principalAed).toBe('800000.00');
    expect(result.downPaymentAed).toBe('200000.00');
    expect(result.monthlyPaymentAed).toBe('4222.69');
    expect(Number(result.totalInterestAed)).toBeGreaterThan(0);
  });
  it('handles a fully cash-funded purchase', () =>
    expect(
      service.mortgage({
        priceAed: 1000000,
        downPaymentPercent: 100,
        annualInterestRate: 4,
        years: 25,
      }).monthlyPaymentAed,
    ).toBe('0.00'));
  it('keeps small-rate calculations stable', () =>
    expect(monthlyPayment(120000, 0.000001, 10)).toBeCloseTo(1000, 3));
  it('rejects nonfinite or invalid internal amortization inputs', () => {
    expect(() => monthlyPayment(100000, 4, 0)).toThrow(BadRequestException);
    expect(() => monthlyPayment(Number.POSITIVE_INFINITY, 4, 20)).toThrow(BadRequestException);
  });
  it('distinguishes gross/net yield and represents negative income', () => {
    const result = service.rentalYield({
      priceAed: 1000000,
      annualRentAed: 80000,
      annualCostsAed: 100000,
    });
    expect(result.grossYieldPercent).toBe('8.00');
    expect(result.netYieldPercent).toBe('-2.00');
    expect(result.annualNetIncomeAed).toBe('-20000.00');
  });
});
