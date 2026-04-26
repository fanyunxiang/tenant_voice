export type TenantRequiredDocumentType = 'PASSPORT' | 'DRIVERS_LICENCE' | 'MEDICARE_CARD';

export type TenantOptionalDocumentType =
  | 'WRITTEN_REFERENCE'
  | 'UTILITY_BILL'
  | 'BANK_STATEMENT'
  | 'RENT_LEDGER';

export type TenantProfileDocumentType = TenantRequiredDocumentType | TenantOptionalDocumentType;

export type TenantRequiredDocumentDefinition = {
  id: string;
  type: TenantRequiredDocumentType;
  label: string;
  points: number;
};

export type TenantOptionalDocumentDefinition = {
  id: string;
  type: TenantOptionalDocumentType;
  label: string;
  weight: number;
};

export const TENANT_REQUIRED_DOCUMENTS: TenantRequiredDocumentDefinition[] = [
  {
    id: 'passport',
    type: 'PASSPORT',
    label: 'Passport (50 points)',
    points: 50,
  },
  {
    id: 'drivers-licence',
    type: 'DRIVERS_LICENCE',
    label: "Driver's Licence (40 points)",
    points: 40,
  },
  {
    id: 'medicare',
    type: 'MEDICARE_CARD',
    label: 'Medicare Card (10 points)',
    points: 10,
  },
];

export const TENANT_OPTIONAL_DOCUMENTS: TenantOptionalDocumentDefinition[] = [
  {
    id: 'written-reference',
    type: 'WRITTEN_REFERENCE',
    label: 'Written Rental Reference',
    weight: 5,
  },
  {
    id: 'utility-bill',
    type: 'UTILITY_BILL',
    label: 'Utility Bill with Current Address',
    weight: 10,
  },
  {
    id: 'bank-statement',
    type: 'BANK_STATEMENT',
    label: 'Bank Statement',
    weight: 10,
  },
  {
    id: 'rent-ledger',
    type: 'RENT_LEDGER',
    label: 'Current Tenant Rent Ledger',
    weight: 10,
  },
];

export type TenantRequiredDocumentStatus = {
  id: string;
  type: TenantRequiredDocumentType;
  label: string;
  points: number;
  uploaded: boolean;
  verified: boolean;
};

export type TenantOptionalDocumentStatus = {
  id: string;
  type: TenantOptionalDocumentType;
  label: string;
  weight: number;
  uploaded: boolean;
  verified: boolean;
};

export type TenantProfileCompleteness = {
  requiredCompleted: number;
  optionalCompleted: number;
  total: number;
};

export type TenantProfileData = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
  };
  profile: {
    aboutMe: string | null;
    preferredAreas: string[];
    budgetMin: number | null;
    budgetMax: number | null;
    moveInDate: string | null;
    householdSize: number | null;
    hasPets: boolean;
  };
  completion: TenantProfileCompleteness;
  requiredDocuments: TenantRequiredDocumentStatus[];
  optionalDocuments: TenantOptionalDocumentStatus[];
};

