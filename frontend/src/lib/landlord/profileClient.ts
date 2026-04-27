import { LandlordProfileData } from './profile';
import { requestLandlord } from './requestClient';

export async function loadLandlordProfile() {
  return requestLandlord<LandlordProfileData>('/api/landlord/profile', {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function updateLandlordProfile(payload: {
  fullName?: string | null;
  phone?: string | null;
  agencyName?: string | null;
  licenseNumber?: string | null;
  portfolioSize?: number | null;
  verificationStatus?: string | null;
}) {
  return requestLandlord<LandlordProfileData>('/api/landlord/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
