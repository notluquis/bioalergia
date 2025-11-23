import { prisma } from "../prisma.js";
import { UserRole } from "../../generated/prisma/client";

export type RoleMapping = {
  employee_role: string;
  app_role: UserRole;
};

export async function listRoleMappings(): Promise<RoleMapping[]> {
  const mappings = await prisma.roleMapping.findMany();
  return mappings.map((m) => ({
    employee_role: m.employeeRole,
    app_role: m.appRole,
  }));
}

export async function upsertRoleMapping(employee_role: string, app_role: UserRole): Promise<void> {
  await prisma.roleMapping.upsert({
    where: { employeeRole: employee_role },
    create: {
      employeeRole: employee_role,
      appRole: app_role,
    },
    update: {
      appRole: app_role,
    },
  });
}
