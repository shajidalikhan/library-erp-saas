import { redirect } from 'next/navigation';

import { ROUTES } from '@/constants/routes';

export default function SettingsIndexPage() {
  redirect(`${ROUTES.SETTINGS}/profile`);
}
