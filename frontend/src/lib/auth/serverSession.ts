import { cookies } from 'next/headers';
import { ACCESS_TOKEN_COOKIE } from './constants';
import { getSupabaseAuthClient } from 'lib/supabase/authClient';
import { findAppUserByAuthUserId } from './userProvisioning';

export type ServerSessionUser = {
  id: string;
  email: string;
  full_name: string | null;
  primary_role: string;
  status: string;
};

export async function getServerSessionUser(): Promise<ServerSessionUser | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

    if (!accessToken) {
      return null;
    }

    const authClient = getSupabaseAuthClient();
    const authUserResult = await authClient.auth.getUser(accessToken);
    if (authUserResult.error || !authUserResult.data.user) {
      return null;
    }

    const appUser = await findAppUserByAuthUserId(authUserResult.data.user.id);
    if (!appUser) {
      return null;
    }

    return appUser;
  } catch {
    return null;
  }
}
