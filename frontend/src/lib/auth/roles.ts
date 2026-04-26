export const REGISTERABLE_ROLES = ['tenant', 'landlord', 'maintenance_worker'] as const;

export type RegisterableRole = (typeof REGISTERABLE_ROLES)[number];

export const DATABASE_ROLE_MAP: Record<
  RegisterableRole,
  'TENANT' | 'LANDLORD' | 'SERVICE_PROVIDER'
> = {
  tenant: 'TENANT',
  landlord: 'LANDLORD',
  maintenance_worker: 'SERVICE_PROVIDER',
};

export const ROLE_PROFILE_TABLE_MAP: Record<RegisterableRole, string> = {
  tenant: 'tenant_profiles',
  landlord: 'landlord_profiles',
  maintenance_worker: 'service_provider_profiles',
};

const INPUT_ROLE_MAP: Record<string, RegisterableRole> = {
  tenant: 'tenant',
  landlord: 'landlord',
  maintenance_worker: 'maintenance_worker',
  service_provider: 'maintenance_worker',
  worker: 'maintenance_worker',
};

export function normalizeRegisterableRole(rawValue: unknown): RegisterableRole | null {
  if (typeof rawValue !== 'string') {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase();
  return INPUT_ROLE_MAP[normalized] ?? null;
}
