// Query-key factories for the operations pages (channel prices + Haulmer DTE/sync).
// Hierarchical `as const` keys: `all` is a structural prefix of every child key so a
// broad `invalidateQueries({ queryKey: <factory>.all })` also clears the children.
// Mirrors the reference idiom in features/calendar/queries.ts.

// NOTE: `["catalog", "products-all"]` is the product picker on ChannelPricesPage. It is
// NOT the same query as catalogKeys.products (different fn — catalogORPCClient.list vs
// getProducts — and different key shape ["catalog","products",opts]). The catalog factory
// is queryOptions-shaped with no `products-all` entry, so this operations-local key stays
// here under the shared ["catalog"] root rather than being duplicated into catalogKeys.
export const channelPriceKeys = {
  all: ["channel-prices"] as const,
  catalogProducts: ["catalog", "products-all"] as const,
  forProduct: (productId: number) => ["channel-prices", productId] as const,
};

export const haulmerKeys = {
  all: ["haulmer-dte"] as const,
  availablePeriods: ["haulmer-available-periods"] as const,
  emitted: (dteType: number) => ["haulmer-dte", "emitted", dteType] as const,
  folios: ["haulmer-dte", "folios"] as const,
  taxpayer: ["haulmer-dte", "taxpayer"] as const,
  uf: ["haulmer-dte", "uf"] as const,
};
