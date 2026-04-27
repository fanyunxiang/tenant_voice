export type UserRole = 'tenant' | 'landlord';

export type RoleMenuItem = {
  id: string;
  label: string;
  href: string;
  requirement: string;
};

// Requirements source:
// - docs/TenantVoice Project Scope.docx (Tenant Dashboard section)
// - docs/App Features - TenantVoice.docx
export const roleMenus: Record<UserRole, RoleMenuItem[]> = {
  tenant: [
    {
      id: 'listings',
      label: 'Listings',
      href: '/admin/listings',
      requirement: 'Browse property listings + search/filter + view ratings',
    },
    {
      id: 'applications',
      label: 'Applications',
      href: '/admin/applications',
      requirement: 'Submit rental applications + track status history',
    },
    {
      id: 'messages',
      label: 'Messages',
      href: '/admin/messages',
      requirement: 'In-app chat + connection requests + profile recommendations',
    },
    {
      id: 'profile',
      label: 'Profile',
      href: '/admin/profile',
      requirement: 'Create and manage tenant profile + verification completeness',
    },
  ],
  landlord: [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/admin/dashboard',
      requirement: 'Role-based dashboard with portfolio stats and pending actions',
    },
    {
      id: 'properties',
      label: 'Properties',
      href: '/admin/properties',
      requirement: 'Property listing management: create, publish, pause, edit, delete',
    },
    {
      id: 'messages',
      label: 'Messages',
      href: '/admin/messages',
      requirement: 'In-app real-time messages with tenants and enquirers',
    },
    {
      id: 'profile',
      label: 'Profile',
      href: '/admin/profile',
      requirement: 'Edit landlord profile information',
    },
  ],
};

export const defaultUserRole: UserRole = 'tenant';

export function resolveMenuRole(primaryRole: string | null | undefined): UserRole {
  if (typeof primaryRole !== 'string') {
    return defaultUserRole;
  }

  const normalized = primaryRole.trim().toUpperCase();
  if (normalized === 'LANDLORD') {
    return 'landlord';
  }

  return 'tenant';
}
