// biome-ignore lint/suspicious/noExplicitAny: dynamic row input
export function mapTransaction(row: any) {
  return {
    id: Number(row.id),
    transactionDate: row.transactionDate.toISOString(),
    description: row.description,
    transactionType: row.transactionType,
    transactionAmount: row.transactionAmount != null ? Number(row.transactionAmount) : null,
    status: row.status,
    externalReference: row.externalReference,
    sourceId: row.sourceId,
    paymentMethod: row.paymentMethod,
    settlementNetAmount: row.settlementNetAmount != null ? Number(row.settlementNetAmount) : null,
  };
}
