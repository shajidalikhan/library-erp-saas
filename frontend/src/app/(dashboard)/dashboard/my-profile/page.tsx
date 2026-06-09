import { redirect } from 'next/navigation';

import { ROUTES } from '@/constants/routes';

export default function MyProfileRedirectPage() {
  redirect(ROUTES.STUDENT_PORTAL);
}
