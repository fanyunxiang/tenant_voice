export type LandlordProfileData = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
  };
  profile: {
    agencyName: string | null;
    licenseNumber: string | null;
    portfolioSize: number | null;
    verificationStatus: string | null;
  };
};
