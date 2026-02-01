export interface User {
  createdAt: Date;
  email: string;
  hasPasskey: boolean;
  id: number;
  mfaEnabled: boolean;
  passkeysCount: number;
  person: {
    fatherName: null | string;
    names: string;
    rut: string;
  };
  role: string;
  status: "ACTIVE" | "INACTIVE" | "PENDING_SETUP" | "SUSPENDED";
}

export interface UserProfile {
  address?: string;
  bankAccountNumber?: string;
  bankAccountType?: string;
  bankName?: string;
  email: string;
  fatherName: string;
  id: number;
  motherName?: string;
  names: string;
  phone?: string;
  rut: string;
}
