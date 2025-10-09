import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

// === QUERY BUILDERS ===

export interface WhereClause {
  condition: string;
  params: unknown[];
}

export interface QueryBuilder {
  select: string[];
  from: string;
  joins: string[];
  where: WhereClause[];
  orderBy: string[];
  limit?: number;
  offset?: number;
}

export class SQLBuilder {
  private query: QueryBuilder;

  constructor(table: string) {
    this.query = {
      select: ["*"],
      from: table,
      joins: [],
      where: [],
      orderBy: [],
    };
  }

  select(...columns: string[]): this {
    this.query.select = columns;
    return this;
  }

  join(table: string, condition: string): this {
    this.query.joins.push(`JOIN ${table} ON ${condition}`);
    return this;
  }

  leftJoin(table: string, condition: string): this {
    this.query.joins.push(`LEFT JOIN ${table} ON ${condition}`);
    return this;
  }

  where(condition: string, ...params: any[]): this {
    this.query.where.push({ condition, params });
    return this;
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.query.orderBy.push(`${column} ${direction}`);
    return this;
  }

  limit(count: number): this {
    this.query.limit = count;
    return this;
  }

  offset(count: number): this {
    this.query.offset = count;
    return this;
  }

  build(): { sql: string; params: unknown[] } {
    const parts: string[] = [];
    const allParams: unknown[] = [];

    // SELECT
    parts.push(`SELECT ${this.query.select.join(", ")}`);

    // FROM
    parts.push(`FROM ${this.query.from}`);

    // JOINS
    if (this.query.joins.length > 0) {
      parts.push(...this.query.joins);
    }

    // WHERE
    if (this.query.where.length > 0) {
      const conditions = this.query.where.map(w => w.condition).join(" AND ");
      parts.push(`WHERE ${conditions}`);
      this.query.where.forEach(w => allParams.push(...w.params));
    }

    // ORDER BY
    if (this.query.orderBy.length > 0) {
      parts.push(`ORDER BY ${this.query.orderBy.join(", ")}`);
    }

    // LIMIT
    if (this.query.limit !== undefined) {
      parts.push(`LIMIT ${this.query.limit}`);
    }

    // OFFSET
    if (this.query.offset !== undefined) {
      parts.push(`OFFSET ${this.query.offset}`);
    }

    return {
      sql: parts.join("\n"),
      params: allParams,
    };
  }
}

// === COMMON QUERY HELPERS ===

/**
 * Low-level generic query helper returning an array of typed rows.
 * Wraps pool.query while preserving strong typing and reducing repeated RowDataPacket annotations.
 */
export async function query<T extends RowDataPacket>(
  pool: Pool | PoolConnection,
  sql: string,
  params: readonly unknown[] = []
): Promise<T[]> {
  const [rows] = await pool.query<T[]>(sql, params as any[]);
  return rows;
}

/**
 * Returns the first row of a query or null.
 */
export async function queryOne<T extends RowDataPacket>(
  pool: Pool | PoolConnection,
  sql: string,
  params: readonly unknown[] = []
): Promise<T | null> {
  const [rows] = await pool.query<T[]>(sql, params as any[]);
  return rows[0] || null;
}

// Backwards compatibility wrappers (can be migrated gradually to query/queryOne names)
export async function selectOne<T extends RowDataPacket>(
  pool: Pool | PoolConnection,
  sql: string,
  params: readonly unknown[] = []
): Promise<T | null> {
  return queryOne<T>(pool, sql, params);
}

export async function selectMany<T extends RowDataPacket>(
  pool: Pool | PoolConnection,
  sql: string,
  params: readonly unknown[] = []
): Promise<T[]> {
  return query<T>(pool, sql, params);
}

export async function selectFirst<T extends RowDataPacket>(
  pool: Pool | PoolConnection,
  sql: string,
  params: readonly unknown[] = []
): Promise<T | null> {
  const [rows] = await pool.query<T[]>(`${sql} LIMIT 1`, params as any[]);
  return rows[0] || null;
}

export async function insertOne(
  pool: Pool | PoolConnection,
  sql: string,
  params: readonly unknown[] = []
): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(sql, params as any[]);
  return result.insertId;
}

export async function updateRows(
  pool: Pool | PoolConnection,
  sql: string,
  params: readonly unknown[] = []
): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(sql, params as any[]);
  return result.affectedRows;
}

export async function deleteRows(
  pool: Pool | PoolConnection,
  sql: string,
  params: readonly unknown[] = []
): Promise<number> {
  const [result] = await pool.query<ResultSetHeader>(sql, params as any[]);
  return result.affectedRows;
}

export async function exists(
  pool: Pool | PoolConnection,
  table: string,
  condition: string,
  params: readonly unknown[] = []
): Promise<boolean> {
  const sql = `SELECT 1 FROM ${table} WHERE ${condition} LIMIT 1`;
  const row = await selectFirst(pool, sql, params);
  return row !== null;
}

interface CountRow extends RowDataPacket { count: number }
export async function count(
  pool: Pool | PoolConnection,
  table: string,
  condition?: string,
  params: readonly unknown[] = []
): Promise<number> {
  const whereClause = condition ? ` WHERE ${condition}` : "";
  const sql = `SELECT COUNT(*) as count FROM ${table}${whereClause}`;
  const row = await selectFirst<CountRow>(pool, sql, params);
  return row?.count ?? 0;
}

// === TRANSACTION HELPERS ===

export async function withTransaction<T>(
  pool: Pool,
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// === PAGINATION HELPERS ===

export interface PaginationOptions {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function paginate<T extends RowDataPacket>(
  pool: Pool | PoolConnection,
  baseQuery: string,
  params: readonly unknown[],
  options: PaginationOptions
): Promise<PaginatedResult<T>> {
  const { page, pageSize } = options;
  const offset = (page - 1) * pageSize;

  // Count query
  const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`;
  interface TotalRow extends RowDataPacket { total: number }
  const totalRow = await selectFirst<TotalRow>(pool, countQuery, params);
  const total = totalRow?.total ?? 0;

  // Data query with pagination
  const dataQuery = `${baseQuery} LIMIT ${pageSize} OFFSET ${offset}`;
  const data = await selectMany<T>(pool, dataQuery, params);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}