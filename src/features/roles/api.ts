import { apiClient } from "@/lib/apiClient";

export type AppRole = "GOD" | "ADMIN" | "ANALYST" | "VIEWER";

export type RoleMapping = {
  employee_role: string;
  app_role: AppRole;
};

export async function getRoleMappings(): Promise<RoleMapping[]> {
  const res = await apiClient.get<{ data: RoleMapping[] }>("/api/roles/mappings");
  return res.data;
}

export async function saveRoleMapping(mapping: RoleMapping): Promise<void> {
  await apiClient.post("/api/roles/mappings", mapping);
}
