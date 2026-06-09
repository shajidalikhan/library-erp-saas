import { redirect } from 'next/navigation';

import { ROUTES } from '@/constants/routes';

export default function ProfilePage() {
  redirect(`${ROUTES.SETTINGS}/profile`);
}
