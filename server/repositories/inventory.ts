import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "../db.js";
import type { InventoryCategory, InventoryItem, InventoryMovement } from "../types.js";

export async function listInventoryCategories(): Promise<InventoryCategory[]> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, name, created_at FROM inventory_categories ORDER BY name ASC`
  );
  return rows as InventoryCategory[];
}

export async function createInventoryCategory(name: string): Promise<InventoryCategory> {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO inventory_categories (name) VALUES (?)`,
    [name]
  );
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

export async function createInventoryItem(item: Omit<InventoryItem, "id" | "created_at" | "updated_at">): Promise<InventoryItem> {
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
  const fields = Object.keys(item).map((key) => `\`${key}\` = ?`).join(", ");
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
    await connection.query(
      `INSERT INTO inventory_movements (item_id, quantity_change, reason) VALUES (?, ?, ?)`,
      [movement.item_id, movement.quantity_change, movement.reason]
    );
    await connection.query(
      `UPDATE inventory_items SET current_stock = current_stock + ? WHERE id = ?`,
      [movement.quantity_change, movement.item_id]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
