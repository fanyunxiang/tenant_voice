import { requestLandlord } from './requestClient';

export type LandlordDashboardData = {
  inRentCount: number;
  pendingRentCount: number;
  maintenanceCount: number;
  pendingApplicationsCount: number;
  unreadMessagesCount: number;
};

export type LandlordMaintenanceRequestItem = {
  id: string;
  category: string;
  description: string;
  severity: string;
  status: string;
  lodgedAt: string;
  resolvedAt: string | null;
  tenantName: string;
  tenantEmail: string;
  listingId: string | null;
  listingTitle: string;
  property: {
    addressLine1: string;
    suburb: string;
    state: string;
    postcode: string;
  } | null;
  assignedWorker: {
    workerType: string;
    workerName: string;
    assignedAt: string | null;
  } | null;
};

export type LandlordMaintenanceRequestsData = {
  requests: LandlordMaintenanceRequestItem[];
};

export async function loadLandlordDashboard() {
  return requestLandlord<LandlordDashboardData>('/api/landlord/dashboard', {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function loadLandlordMaintenanceRequests() {
  return requestLandlord<LandlordMaintenanceRequestsData>('/api/landlord/maintenance', {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function assignLandlordMaintenanceWorker(payload: {
  complaintId: string;
  workerType: string;
  workerName: string;
}) {
  return requestLandlord<{
    complaintId: string;
    workerType: string;
    workerName: string;
    assignedAt: string;
  }>('/api/landlord/maintenance', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'assignWorker',
      complaintId: payload.complaintId,
      workerType: payload.workerType,
      workerName: payload.workerName,
    }),
  });
}
