import { redirect } from 'next/navigation';

import { ROUTES } from '@/constants/routes';

export default function LegacyBookingsRedirectPage() {
  redirect(`${ROUTES.BOOKINGS_PUBLIC_PAGE}?tab=bookings`);
}
