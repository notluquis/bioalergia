export interface CommonSupply {
  brand?: string;
  description?: string;
  id: number;
  model?: string;
  name: string;
}

export type StructuredSupplies = Record<string, Record<string, string[]>>;

export interface SupplyRequest {
  admin_notes?: string;
  brand?: string;
  created_at: string;
  id: number;
  model?: string;
  notes?: string;
  quantity: number;
  status: "delivered" | "in_transit" | "ordered" | "pending" | "rejected";
  supply_name: string;
  user_email?: string; // Only for admin view
}
