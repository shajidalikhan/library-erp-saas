import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ROUTES } from '@/constants/routes';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

/** Public registration is disabled; accounts are provisioned by administrators. */
export default function RegisterRedirectPage() {
  const jar = cookies();
  const authed = jar.has(ACCESS_COOKIE) || jar.has(REFRESH_COOKIE);
  redirect(authed ? ROUTES.DASHBOARD : ROUTES.LOGIN);
}
