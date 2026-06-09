import { describe, expect, it } from 'vitest';

import {
  formatCatalogPlanDto,
  isValidPlanKey,
  normalizePlanKey,
  sanitizePlanKey,
} from './platform-catalog-plan.util';

describe('platform-catalog-plan.util', () => {
  it('normalizePlanKey uppercases SKUs', () => {
    expect(normalizePlanKey('growth')).toBe('GROWTH');
    expect(normalizePlanKey(' Pro_Team ')).toBe('PRO_TEAM');
  });

  it('sanitizePlanKey normalizes user input', () => {
    expect(sanitizePlanKey('starter plan')).toBe('STARTER_PLAN');
    expect(sanitizePlanKey('  free  ')).toBe('FREE');
    expect(isValidPlanKey('STARTER_PLAN')).toBe(true);
    expect(isValidPlanKey('x')).toBe(false);
  });

  it('formatCatalogPlanDto returns uppercase planKey and trimmed displayName', () => {
    const dto = formatCatalogPlanDto({
      _id: 'abc',
      planKey: 'Basic',
      displayName: ' Basic ',
      monthlyPrice: 499,
    });
    expect(dto.planKey).toBe('BASIC');
    expect(dto.displayName).toBe('Basic');
    expect(dto.id).toBe('abc');
  });
});
