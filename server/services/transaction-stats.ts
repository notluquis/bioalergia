import { prisma } from "../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { parseDateOnly } from "../lib/time.js";

export interface TransactionStatsFilters {
  from?: string;
  to?: string;
}

export interface MonthlyStats {
  month: string;
  in: number;
  out: number;
  net: number;
}

export interface TransactionsByType {
  description: string | null;
  direction: "IN" | "OUT" | "NEUTRO";
  total: number;
}

export interface StatsResult {
  monthly: MonthlyStats[];
  totals: Record<string, number>;
  byType: TransactionsByType[];
}

export interface ParticipantStats {
  participant: string;
  transactionCount: number;
  totalAmount: number;
}

/**
 * Get transaction statistics by date range
 */
export async function getTransactionStats(filters: TransactionStatsFilters): Promise<StatsResult> {
  const fromDate = filters.from ? parseDateOnly(filters.from) : undefined;
  const toDate = filters.to ? parseDateOnly(filters.to) : undefined;

  const where: Prisma.TransactionWhereInput = {};
  if (fromDate || toDate) {
    where.timestamp = {};
    if (fromDate) where.timestamp.gte = fromDate;
    if (toDate) where.timestamp.lte = toDate;
  }

  // Monthly aggregation
  const monthlyData = await prisma.$queryRaw<
    Array<{ month: string; direction: string; total: bigint; amount: number | null }>
  >(Prisma.sql`
    SELECT 
      TO_CHAR(timestamp, 'YYYY-MM') as month,
      direction,
      COUNT(*) as total,
      SUM(amount) as amount
    FROM transactions
    WHERE ${fromDate ? Prisma.sql`timestamp >= ${fromDate}` : Prisma.sql`1=1`}
      AND ${toDate ? Prisma.sql`timestamp <= ${toDate}` : Prisma.sql`1=1`}
    GROUP BY TO_CHAR(timestamp, 'YYYY-MM'), direction
    ORDER BY month
  `);

  // Transform to monthly stats
  const monthlyMap = new Map<string, MonthlyStats>();
  for (const row of monthlyData) {
    if (!monthlyMap.has(row.month)) {
      monthlyMap.set(row.month, { month: row.month, in: 0, out: 0, net: 0 });
    }
    const stats = monthlyMap.get(row.month)!;
    const amount = row.amount ?? 0;
    if (row.direction === "IN") {
      stats.in += amount;
      stats.net += amount;
    } else if (row.direction === "OUT") {
      stats.out += amount;
      stats.net -= amount;
    }
  }

  // By type aggregation
  const byType = await prisma.transaction.groupBy({
    by: ["description", "direction"],
    where,
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 20,
  });

  // Totals
  const totals = await prisma.transaction.aggregate({
    where,
    _count: { id: true },
    _sum: { amount: true },
  });

  return {
    monthly: Array.from(monthlyMap.values()),
    totals: {
      count: totals._count.id,
      total: Number(totals._sum.amount ?? 0),
    },
    byType: byType.map((item) => ({
      description: item.description,
      direction: item.direction as "IN" | "OUT" | "NEUTRO",
      total: item._count.id,
    })),
  };
}

/**
 * Get participant leaderboard by transaction volume
 */
export async function getParticipantLeaderboard(params: {
  from?: string;
  to?: string;
  limit?: number;
  mode?: "combined" | "incoming" | "outgoing";
}): Promise<ParticipantStats[]> {
  const { from, to, limit = 10, mode = "combined" } = params;
  const fromDate = from ? parseDateOnly(from) : undefined;
  const toDate = to ? parseDateOnly(to) : undefined;

  const where: Prisma.TransactionWhereInput = {};
  if (fromDate || toDate) {
    where.timestamp = {};
    if (fromDate) where.timestamp.gte = fromDate;
    if (toDate) where.timestamp.lte = toDate;
  }

  if (mode === "incoming") {
    where.direction = "IN";
  } else if (mode === "outgoing") {
    where.direction = "OUT";
  }

  const participantField = mode === "incoming" ? "origin" : "destination";

  const results = await prisma.transaction.groupBy({
    by: [participantField],
    where: {
      ...where,
      [participantField]: { not: null },
    },
    _count: { id: true },
    _sum: { amount: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  return results.map((item) => ({
    participant: (item[participantField as keyof typeof item] as string) ?? "Unknown",
    transactionCount: item._count.id,
    totalAmount: Number(item._sum.amount ?? 0),
  }));
}

/**
 * Get detailed stats for a specific participant
 */
export async function getParticipantInsight(
  participantId: string,
  filters: { from?: string; to?: string }
): Promise<{
  participant: string;
  totalTransactions: number;
  totalAmount: number;
  incoming: { count: number; amount: number };
  outgoing: { count: number; amount: number };
  recentTransactions: Array<{
    id: number;
    timestamp: Date;
    description: string | null;
    amount: number | null;
    direction: string;
  }>;
}> {
  const fromDate = filters.from ? parseDateOnly(filters.from) : undefined;
  const toDate = filters.to ? parseDateOnly(filters.to) : undefined;

  const where: Prisma.TransactionWhereInput = {
    OR: [{ origin: participantId }, { destination: participantId }],
  };

  if (fromDate || toDate) {
    where.timestamp = {};
    if (fromDate) where.timestamp.gte = fromDate;
    if (toDate) where.timestamp.lte = toDate;
  }

  const [total, incoming, outgoing, recent] = await Promise.all([
    prisma.transaction.aggregate({
      where,
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, direction: "IN", origin: participantId },
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, direction: "OUT", destination: participantId },
      _count: { id: true },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 10,
      select: {
        id: true,
        timestamp: true,
        description: true,
        amount: true,
        direction: true,
      },
    }),
  ]);

  return {
    participant: participantId,
    totalTransactions: total._count.id,
    totalAmount: Number(total._sum.amount ?? 0),
    incoming: {
      count: incoming._count.id,
      amount: Number(incoming._sum.amount ?? 0),
    },
    outgoing: {
      count: outgoing._count.id,
      amount: Number(outgoing._sum.amount ?? 0),
    },
    recentTransactions: recent.map((t) => ({
      ...t,
      amount: t.amount ? Number(t.amount) : null,
      direction: t.direction as string,
    })),
  };
}
