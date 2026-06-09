import { redirect } from 'next/navigation';

import { ROUTES } from '@/constants/routes';

export default function LegacySettingsPublicPageRedirect() {
  redirect(ROUTES.BOOKINGS_PUBLIC_PAGE);
}
