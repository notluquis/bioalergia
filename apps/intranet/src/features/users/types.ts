export interface User {
  createdAt: Date;
  email: string;
  hasPasskey: boolean;
  id: number;
  mfaEnabled: boolean;
  mfaEnforced: boolean;
  passkeysCount: number;
  person: {
    address: null | string;
    fatherName: null | string;
    motherName: null | string;
    names: string;
    phone: null | string;
    rut: string;
  };
  employee: null | {
    bankAccountNumber: null | string;
    bankAccountType: null | string;
    bankName: null | string;
    department: null | string;
    position: string;
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

export interface UserProfileUpdatePayload {
  address?: null | string;
  bankAccountNumber?: null | string;
  bankAccountType?: null | string;
  bankName?: null | string;
  department?: null | string;
  email: string;
  fatherName?: null | string;
  mfaEnforced?: boolean;
  motherName?: null | string;
  names: string;
  phone?: null | string;
  position: string;
  rut: string;
}
