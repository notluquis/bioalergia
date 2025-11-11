export type InventoryCategory = {
  id: number;
  name: string;
};

export type InventoryItem = {
  id: number;
  category_id: number | null;
  name: string;
  description: string | null;
  current_stock: number;
  category_name?: string;
};

export type InventoryMovement = {
  item_id: number;
  quantity_change: number;
  reason: string;
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
