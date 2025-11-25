import { prisma } from "../prisma.js";
import { UserRole } from "../../generated/prisma/client.js";

export type RoleMapping = {
  employee_role: string;
  app_role: UserRole;
};

export async function listRoleMappings(): Promise<RoleMapping[]> {
  const mappings = await prisma.roleMapping.findMany();
  return mappings.map((m: { employeeRole: string; appRole: UserRole }) => ({
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

import { findEmployeeByEmail } from "./employees.js";

export async function resolveUserRole(user: { email: string; role: UserRole }): Promise<UserRole> {
  const employee = await findEmployeeByEmail(user.email);
  const mappings = await listRoleMappings();
  const mapping = employee ? mappings.find((m) => m.employee_role === employee.role) : undefined;
  return mapping ? mapping.app_role : user.role;
}
