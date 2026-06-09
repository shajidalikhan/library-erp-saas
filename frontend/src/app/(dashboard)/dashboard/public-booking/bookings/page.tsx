import { redirect } from 'next/navigation';

import { ROUTES } from '@/constants/routes';

export default function LegacyPublicBookingListRedirectPage() {
  redirect(`${ROUTES.BOOKINGS_PUBLIC_PAGE}?tab=bookings`);
}
