export type Role = {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permissionId: number; permission: Permission }[];
};

export type Permission = {
  id: number;
  action: string;
  subject: string;
  description: string | null;
};
