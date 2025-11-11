import type express from "express";
import type { UserRole } from "./db.js";

export type AuthSession = {
  userId: number;
  email: string;
  role: UserRole;
};

export type AuthenticatedRequest = express.Request & { auth?: AuthSession };

export type InventoryCategory = {
  id: number;
  name: string;
  created_at: string;
};

export type InventoryItem = {
  id: number;
  category_id: number | null;
  name: string;
  description: string | null;
  current_stock: number;
  created_at: string;
  updated_at: string;
  category_name?: string; // For joining
};

export type InventoryMovement = {
  id: number;
  item_id: number;
  quantity_change: number;
  reason: string | null;
  created_at: string;
};

export type AllergyTypeRecord = {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  level: "type" | "category" | "subtype";
  created_at: string;
  updated_at: string;
};

export type InventoryProviderRecord = {
  id: number;
  rut: string;
  name: string;
  contact_info: string | null;
  created_at: string;
  updated_at: string;
};

export type AllergyInventoryProvider = {
  provider_id: number;
  provider_name: string;
  provider_rut: string;
  current_price: number | null;
  last_stock_check: string | null;
  last_price_check: string | null;
  accounts: string[];
};

export type AllergyInventoryOverview = {
  item_id: number;
  name: string;
  description: string | null;
  current_stock: number;
  category: {
    id: number | null;
    name: string | null;
  };
  allergy_type: {
    type?: { id: number; name: string };
    category?: { id: number; name: string };
    subtype?: { id: number; name: string };
  };
  providers: AllergyInventoryProvider[];
};
