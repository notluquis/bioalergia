import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "../db.js";
import type {
  AllergyInventoryOverview,
  AllergyInventoryProvider,
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
} from "../types.js";

export async function listInventoryCategories(): Promise<InventoryCategory[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, created_at FROM inventory_categories ORDER BY name ASC`
  );
  return rows as InventoryCategory[];
}

export async function createInventoryCategory(name: string): Promise<InventoryCategory> {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(`INSERT INTO inventory_categories (name) VALUES (?)`, [name]);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, created_at FROM inventory_categories WHERE id = ?`,
    [result.insertId]
  );
  return rows[0] as InventoryCategory;
}

export async function listInventoryItems(): Promise<InventoryItem[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 
      i.id, i.category_id, i.name, i.description, i.current_stock, i.created_at, i.updated_at, c.name as category_name
     FROM inventory_items i
     LEFT JOIN inventory_categories c ON i.category_id = c.id
     ORDER BY i.name ASC`
  );
  return rows as InventoryItem[];
}

export async function createInventoryItem(
  item: Omit<InventoryItem, "id" | "created_at" | "updated_at">
): Promise<InventoryItem> {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO inventory_items (category_id, name, description, current_stock) VALUES (?, ?, ?, ?)`,
    [item.category_id, item.name, item.description, item.current_stock]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, category_id, name, description, current_stock, created_at, updated_at FROM inventory_items WHERE id = ?`,
    [result.insertId]
  );
  return rows[0] as InventoryItem;
}

export async function updateInventoryItem(
  id: number,
  item: Partial<Omit<InventoryItem, "id" | "created_at" | "updated_at">>
): Promise<InventoryItem> {
  const pool = getPool();
  const fields = Object.keys(item)
    .map((key) => `\`${key}\` = ?`)
    .join(", ");
  const values = Object.values(item);
  await pool.query(`UPDATE inventory_items SET ${fields} WHERE id = ?`, [...values, id]);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, category_id, name, description, current_stock, created_at, updated_at FROM inventory_items WHERE id = ?`,
    [id]
  );
  return rows[0] as InventoryItem;
}

export async function deleteInventoryItem(id: number): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM inventory_items WHERE id = ?", [id]);
}

export async function createInventoryMovement(movement: Omit<InventoryMovement, "id" | "created_at">): Promise<void> {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`INSERT INTO inventory_movements (item_id, quantity_change, reason) VALUES (?, ?, ?)`, [
      movement.item_id,
      movement.quantity_change,
      movement.reason,
    ]);
    await connection.query(`UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?`, [
      movement.quantity_change,
      movement.item_id,
    ]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function createInventoryProviderCheck(
  itemProviderId: number,
  payload: {
    check_type: "stock" | "price" | "request";
    quantity?: number | null;
    price?: number | null;
    notes?: string | null;
    transaction_id?: number | null;
  }
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO inventory_provider_checks (item_provider_id, check_type, quantity, price, notes, transaction_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      itemProviderId,
      payload.check_type,
      payload.quantity ?? null,
      payload.price ?? null,
      payload.notes ?? null,
      payload.transaction_id ?? null,
    ]
  );
}

export async function listAllergyInventoryOverview(): Promise<AllergyInventoryOverview[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       i.id as item_id,
       i.name as item_name,
       i.description,
       i.current_stock,
       c.id as category_id,
       c.name as category_name,
       subtype.id as subtype_id,
       subtype.name as subtype_name,
       parent.id as parent_id,
       parent.name as parent_name,
       root.id as root_id,
       root.name as root_name
     FROM inventory_items i
     LEFT JOIN inventory_categories c ON c.id = i.category_id
     LEFT JOIN inventory_allergy_types subtype ON subtype.id = i.allergy_type_id
     LEFT JOIN inventory_allergy_types parent ON parent.id = subtype.parent_id
     LEFT JOIN inventory_allergy_types root ON root.id = parent.parent_id
     ORDER BY root.name ASC, parent.name ASC, subtype.name ASC, i.name ASC`
  );

  const [providerRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       ip.item_id,
       ip.provider_id,
       ip.current_price,
       ip.last_stock_check,
       ip.last_price_check,
       p.name as provider_name,
       p.rut as provider_rut,
       pa.account_identifier
     FROM inventory_item_providers ip
     JOIN inventory_providers p ON p.id = ip.provider_id
     LEFT JOIN provider_accounts pa ON pa.provider_id = p.id
     ORDER BY ip.item_id, ip.provider_id`
  );

  const providerAccounts = new Map<number, Set<string>>();
  providerRows.forEach((row) => {
    if (!row.provider_id || !row.account_identifier) return;
    const key = Number(row.provider_id);
    const existing = providerAccounts.get(key) ?? new Set<string>();
    existing.add(String(row.account_identifier));
    providerAccounts.set(key, existing);
  });

  const providersByItem = new Map<number, AllergyInventoryProvider[]>();
  providerRows.forEach((row) => {
    const itemId = Number(row.item_id);
    if (!itemId) return;
    const providerId = Number(row.provider_id);
    let list = providersByItem.get(itemId);
    if (!list) {
      list = [];
      providersByItem.set(itemId, list);
    }
    let provider = list.find((entry) => entry.provider_id === providerId);
    if (!provider) {
      provider = {
        provider_id: providerId,
        provider_name: String(row.provider_name),
        provider_rut: String(row.provider_rut),
        current_price: row.current_price != null ? Number(row.current_price) : null,
        last_stock_check: row.last_stock_check ? String(row.last_stock_check) : null,
        last_price_check: row.last_price_check ? String(row.last_price_check) : null,
        accounts: Array.from(providerAccounts.get(providerId) ?? []),
      };
      list.push(provider);
    }
  });

  return rows.map((row) => ({
    item_id: Number(row.item_id),
    name: String(row.item_name),
    description: row.description ? String(row.description) : null,
    current_stock: Number(row.current_stock),
    category: {
      id: row.category_id ? Number(row.category_id) : null,
      name: row.category_name ? String(row.category_name) : null,
    },
    allergy_type: {
      type: row.root_id ? { id: Number(row.root_id), name: String(row.root_name) } : undefined,
      category: row.parent_id ? { id: Number(row.parent_id), name: String(row.parent_name) } : undefined,
      subtype: row.subtype_id ? { id: Number(row.subtype_id), name: String(row.subtype_name) } : undefined,
    },
    providers: providersByItem.get(Number(row.item_id)) ?? [],
  }));
}
