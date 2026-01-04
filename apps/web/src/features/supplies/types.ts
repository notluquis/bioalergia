export interface SupplyRequest {
  id: number;
  supply_name: string;
  quantity: number;
  brand?: string;
  model?: string;
  notes?: string;
  status: "pending" | "ordered" | "in_transit" | "delivered" | "rejected";
  admin_notes?: string;
  created_at: string;
  user_email?: string; // Only for admin view
}

export interface CommonSupply {
  id: number;
  name: string;
  brand?: string;
  model?: string;
  description?: string;
}

export interface StructuredSupplies {
  [name: string]: {
    [brand: string]: string[];
  };
}
