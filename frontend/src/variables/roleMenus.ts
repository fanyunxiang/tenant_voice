export type UserRole = 'tenant';

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
};

export const defaultUserRole: UserRole = 'tenant';
