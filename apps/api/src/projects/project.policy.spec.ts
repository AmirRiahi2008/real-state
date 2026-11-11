import { BadRequestException } from '@nestjs/common';
import {
  validateFloorPlans,
  validatePaymentPlan,
  validateProjectFacts,
  validateProjectNulls,
  validateProjectSearch,
} from './project.policy';
import { SearchProjectsDto } from './dto/project.dto';
import { buildProjectWhere, publicProjectWhere } from './projects.repository';

describe('Off-plan project policy', () => {
  it('requires the complete payment plan to sum to 100 exactly', () => {
    expect(() =>
      validatePaymentPlan([
        { labelEn: 'Booking', labelAr: 'حجز', percentage: 10 },
        { labelEn: 'Handover', labelAr: 'تسليم', percentage: 80 },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      validatePaymentPlan([
        { labelEn: 'Booking', labelAr: 'حجز', percentage: 10.1 },
        { labelEn: 'Handover', labelAr: 'تسليم', percentage: 89.9 },
      ]),
    ).not.toThrow();
  });
  it('allows an explicitly unavailable payment plan rather than fake values', () =>
    expect(() => validatePaymentPlan([])).not.toThrow());
  it('rejects a bedroom range that is inverted', () =>
    expect(() =>
      validateProjectFacts({ priceOnRequest: true, minBedrooms: 4, maxBedrooms: 2 }),
    ).toThrow(BadRequestException));
  it('requires positive priced inventory or explicit price-on-request', () =>
    expect(() =>
      validateProjectFacts({
        priceOnRequest: false,
        startingPriceAed: '0',
        minBedrooms: 0,
        maxBedrooms: 2,
      }),
    ).toThrow(BadRequestException));
  it('rejects floor plans outside the advertised unit range', () =>
    expect(() =>
      validateFloorPlans([{ nameEn: 'Large', nameAr: 'كبير', bedrooms: 5, areaSqm: '150' }], 1, 3),
    ).toThrow(BadRequestException));
  it('rejects zero-area floor plans', () =>
    expect(() =>
      validateFloorPlans([{ nameEn: 'Small', nameAr: 'صغير', bedrooms: 1, areaSqm: '0' }], 1, 3),
    ).toThrow(BadRequestException));
  it('rejects null nested arrays', () =>
    expect(() => validateProjectNulls({ floorPlans: null })).toThrow(BadRequestException));
  it('rejects inverted handover ranges', () =>
    expect(() =>
      validateProjectSearch(
        Object.assign(new SearchProjectsDto(), {
          handoverFrom: '2030-01-01',
          handoverTo: '2029-01-01',
        }),
      ),
    ).toThrow(BadRequestException));
  it('never removes public scope when filtering', () =>
    expect(buildProjectWhere(Object.assign(new SearchProjectsDto(), { q: 'villa' })).AND).toEqual(
      expect.arrayContaining([publicProjectWhere]),
    ));
});
