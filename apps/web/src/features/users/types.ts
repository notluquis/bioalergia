export interface User {
  id: number;
  email: string;
  role: string;
  mfaEnabled: boolean;
  passkeysCount: number;
  hasPasskey: boolean;
  status: "ACTIVE" | "INACTIVE" | "PENDING_SETUP" | "SUSPENDED";
  createdAt: string;
  person: {
    names: string;
    fatherName: string | null;
    rut: string;
  };
}

export interface UserProfile {
  id: number;
  email: string;
  names: string;
  fatherName: string;
  motherName?: string;
  rut: string;
  phone?: string;
  address?: string;
  bankName?: string;
  bankAccountType?: string;
  bankAccountNumber?: string;
}
