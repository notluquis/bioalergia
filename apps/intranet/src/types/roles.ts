export interface Permission {
  action: string;
  description: null | string;
  id: number;
  subject: string;
}

export interface Role {
  description: null | string;
  id: number;
  isSystem: boolean;
  name: string;
  permissions: { permission: Permission; permissionId: number }[];
}
