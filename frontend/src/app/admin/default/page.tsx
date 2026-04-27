import { redirect } from 'next/navigation';
import { getServerSessionUser } from 'lib/auth/serverSession';

export default async function DefaultPage() {
  const sessionUser = await getServerSessionUser();

  if (sessionUser?.primary_role === 'LANDLORD') {
    redirect('/admin/dashboard');
  }

  redirect('/admin/listings');
}
