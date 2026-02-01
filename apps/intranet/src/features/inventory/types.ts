export interface AllergyInventoryOverview {
  allergy_type: {
    category?: { id: number; name: string };
    subtype?: { id: number; name: string };
    type?: { id: number; name: string };
  };
  category: {
    id: null | number;
    name: null | string;
  };
  current_stock: number;
  description: null | string;
  item_id: number;
  name: string;
  providers: AllergyInventoryProvider[];
}

export interface AllergyInventoryProvider {
  accounts: string[];
  current_price: null | number;
  last_price_check: null | string;
  last_stock_check: null | string;
  provider_id: number;
  provider_name: string;
  provider_rut: string;
}

export interface InventoryCategory {
  created_at?: Date;
  id: number;
  name: string;
}

export interface InventoryItem {
  category_id: null | number;
  category_name?: string;
  current_stock: number;
  created_at?: Date;
  description: null | string;
  id: number;
  name: string;
  updated_at?: Date;
}

export interface InventoryMovement {
  item_id: number;
  quantity_change: number;
  reason: string;
}
