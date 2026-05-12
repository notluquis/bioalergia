interface DateRangeKey {
  from?: string;
  to?: string;
}

export const queryKeys = {
  balances: {
    report: (params: DateRangeKey) => ["balances", "report", params] as const,
  },
  dashboard: {
    recentMovements: (params?: { includeAmounts?: boolean; page?: number; pageSize?: number }) =>
      ["dashboard", "recentMovements", params ?? {}] as const,
    stats: (params: DateRangeKey) => ["dashboard", "stats", params] as const,
  },
  inventory: {
    items: () => ["inventory", "items"] as const,
  },
  participants: {
    leaderboard: (params: { from?: string; limit?: number; mode?: string; to?: string }) =>
      ["participants", "leaderboard", params] as const,
  },
  stats: {
    overview: (params: DateRangeKey) => ["stats", "overview", params] as const,
  },
  supplies: {
    common: () => ["supplies", "common"] as const,
    requests: () => ["supplies", "requests"] as const,
  },
  transactions: {
    movements: (params: {
      filters: {
        description?: string;
        destination?: string;
        direction?: string;
        from?: string;
        includeAmounts?: boolean;
        origin?: string;
        sourceId?: string;
        to?: string;
      };
      page: number;
      pageSize: number;
    }) => ["transactions", "movements", params] as const,
  },
};
