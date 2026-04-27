import { requestLandlord } from './requestClient';

export const LANDLORD_PROPERTY_TYPES = [
  'APARTMENT',
  'HOUSE',
  'STUDIO',
  'TOWNHOUSE',
  'UNIT',
  'DUPLEX',
  'OTHER',
] as const;

export type LandlordPropertyType = (typeof LANDLORD_PROPERTY_TYPES)[number];

export const LANDLORD_LISTING_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'APPLICATIONS_CLOSED',
  'LEASED',
  'ARCHIVED',
] as const;

export type LandlordListingStatus = (typeof LANDLORD_LISTING_STATUSES)[number];

export type LandlordPropertyListItem = {
  listingId: string;
  propertyId: string;
  title: string;
  description: string | null;
  weeklyRent: number;
  status: LandlordListingStatus;
  availableFrom: string | null;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: LandlordPropertyType;
  pendingApplications: number;
  updatedAt: string;
};

type LoadLandlordPropertiesData = {
  properties: LandlordPropertyListItem[];
};

type CreateLandlordPropertyPayload = {
  title: string;
  description?: string | null;
  weeklyRent: number;
  availableFrom?: string | null;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  propertyType?: LandlordPropertyType;
};

type UpdateLandlordPropertyPayload = {
  title?: string;
  description?: string | null;
  weeklyRent?: number;
  availableFrom?: string | null;
  addressLine1?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
};

export async function loadLandlordProperties() {
  return requestLandlord<LoadLandlordPropertiesData>('/api/landlord/properties', {
    method: 'GET',
    cache: 'no-store',
  });
}

export async function createLandlordProperty(payload: CreateLandlordPropertyPayload) {
  return requestLandlord<{ listingId: string; propertyId: string }>('/api/landlord/properties', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function updateLandlordProperty(listingId: string, payload: UpdateLandlordPropertyPayload) {
  return requestLandlord(`/api/landlord/properties/${encodeURIComponent(listingId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'update',
      ...payload,
    }),
  });
}

export async function setLandlordListingStatus(listingId: string, status: LandlordListingStatus) {
  return requestLandlord(`/api/landlord/properties/${encodeURIComponent(listingId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'setStatus',
      status,
    }),
  });
}

export async function deleteLandlordProperty(listingId: string) {
  return requestLandlord(`/api/landlord/properties/${encodeURIComponent(listingId)}`, {
    method: 'DELETE',
  });
}
