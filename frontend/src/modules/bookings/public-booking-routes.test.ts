import { describe, expect, it } from 'vitest';

import { ROUTES } from '@/constants/routes';

describe('public booking routes', () => {
  it('uses single public booking module route', () => {
    expect(ROUTES.BOOKINGS_PUBLIC_PAGE).toBe('/dashboard/public-booking');
  });

  it('legacy bookings route targets bookings tab query', () => {
    expect(`${ROUTES.BOOKINGS_PUBLIC_PAGE}?tab=bookings`).toBe('/dashboard/public-booking?tab=bookings');
  });
});
