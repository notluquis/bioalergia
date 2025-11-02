type DateRangeKey = { from?: string; to?: string };

export const queryKeys = {
  dashboard: {
    stats: (params: DateRangeKey) => ["dashboard", "stats", params] as const,
    recentMovements: (params?: { page?: number; pageSize?: number; includeAmounts?: boolean }) =>
      ["dashboard", "recentMovements", params ?? {}] as const,
  },
  transactions: {
    movements: (params: {
      filters: {
        from?: string;
        to?: string;
        description?: string;
        sourceId?: string;
        origin?: string;
        destination?: string;
        direction?: string;
        includeAmounts?: boolean;
      };
      page: number;
      pageSize: number;
    }) => ["transactions", "movements", params] as const,
  },
  participants: {
    leaderboard: (params: { from?: string; to?: string; limit?: number; mode?: string }) =>
      ["participants", "leaderboard", params] as const,
  },
  stats: {
    overview: (params: DateRangeKey) => ["stats", "overview", params] as const,
  },
  balances: {
    report: (params: DateRangeKey) => ["balances", "report", params] as const,
  },
  inventory: {
    items: () => ["inventory", "items"] as const,
  },
  supplies: {
    requests: () => ["supplies", "requests"] as const,
    common: () => ["supplies", "common"] as const,
  },
};
