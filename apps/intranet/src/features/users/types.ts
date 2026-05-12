export interface User {
  createdAt: Date;
  email: string;
  hasPasskey: boolean;
  id: number;
  loginEmail: string;
  mfaEnabled: boolean;
  mfaEnforced: boolean;
  notificationEmail: string;
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
  loginEmail: string;
  motherName?: string;
  names: string;
  notificationEmail?: string;
  phone?: string;
  rut: string;
}

export interface UserProfileUpdatePayload {
  address?: null | string;
  bankAccountNumber?: null | string;
  bankAccountType?: null | string;
  bankName?: null | string;
  department?: null | string;
  loginEmail?: null | string;
  notificationEmail: string;
  fatherName?: null | string;
  mfaEnforced?: boolean;
  motherName?: null | string;
  names: string;
  phone?: null | string;
  position: string;
  rut: string;
}
