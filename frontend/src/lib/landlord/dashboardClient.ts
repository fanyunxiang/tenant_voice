import { requestLandlord } from './requestClient';

export type LandlordDashboardData = {
  inRentCount: number;
  pendingRentCount: number;
  maintenanceCount: number;
  pendingApplicationsCount: number;
  unreadMessagesCount: number;
};

export async function loadLandlordDashboard() {
  return requestLandlord<LandlordDashboardData>('/api/landlord/dashboard', {
    method: 'GET',
    cache: 'no-store',
  });
}
