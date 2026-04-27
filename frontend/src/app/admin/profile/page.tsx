import { getServerSessionUser } from 'lib/auth/serverSession';
import LandlordProfileClient from './LandlordProfileClient';
import ProfileOverviewClient from './ProfileOverviewClient';

export default async function ProfilePage() {
  const sessionUser = await getServerSessionUser();

  if (sessionUser?.primary_role === 'LANDLORD') {
    return <LandlordProfileClient />;
  }

  return <ProfileOverviewClient />;
}
