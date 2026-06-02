import { dbClinicalSeries as db } from "@finanzas/db/slices";

import type { ClinicalSeriesLinkedDocument } from "../types.ts";

import type { SnapshotLinkMaps } from "./assemble.ts";

// Batched loader for the three DTE-link projections a snapshot needs, for any
// number of clinical series at once. Replaces the per-series
// `WHERE clinical_series_id = $id` round-trips (the old N+1) with three
// `WHERE clinical_series_id = ANY($ids)` queries grouped in memory.
//
// `foliosByEventId` / `documentsByEventId` are keyed by event id, which is
// globally unique to one series, so a single shared map per kind is correct —
// each series only ever reads its own events' ids. Only `linkedDocuments` is a
// series-level aggregate, so it is grouped per series id.
export async function loadSnapshotLinkMaps(
  seriesIds: number[]
): Promise<Map<number, SnapshotLinkMaps>> {
  const result = new Map<number, SnapshotLinkMaps>();
  if (seriesIds.length === 0) return result;

  const foliosByEventId = new Map<number, string[]>();
  const documentsByEventId = new Map<
    number,
    Array<{ dteSaleDetailId: string; folio: string; totalAmount: number }>
  >();

  // Seed every requested series with empty maps so absent links yield [].
  for (const id of seriesIds) {
    result.set(id, { linkedDocuments: [], foliosByEventId, documentsByEventId });
  }

  const linkedDocumentRows = await db.$queryRaw<
    Array<ClinicalSeriesLinkedDocument & { seriesId: number }>
  >`
    SELECT DISTINCT ON (e.clinical_series_id, s.id)
      e.clinical_series_id AS "seriesId",
      s.id AS "dteSaleDetailId",
      s.client_name AS "clientName",
      s.client_rut AS "clientRUT",
      to_char(s.document_date, 'YYYY-MM-DD') AS "documentDate",
      s.folio AS "folio",
      COALESCE(s.total_amount, 0)::float AS "totalAmount",
      l.matched_by AS "matchedBy",
      l.confidence_score::float AS "confidenceScore"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE e.clinical_series_id = ANY(${seriesIds})
      AND l.status != 'REJECTED'
    ORDER BY e.clinical_series_id, s.id, l.updated_at DESC
  `;
  for (const row of linkedDocumentRows) {
    const { seriesId, ...document } = row;
    const entry = result.get(seriesId);
    if (entry) entry.linkedDocuments.push(document);
  }

  const eventFolioRows = await db.$queryRaw<Array<{ eventId: number; folios: string[] }>>`
    SELECT l.event_id AS "eventId", ARRAY_AGG(s.folio ORDER BY s.document_date) AS "folios"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE e.clinical_series_id = ANY(${seriesIds})
      AND l.status != 'REJECTED'
    GROUP BY l.event_id
  `;
  for (const row of eventFolioRows) {
    foliosByEventId.set(row.eventId, row.folios);
  }

  const eventDocumentRows = await db.$queryRaw<
    Array<{ dteSaleDetailId: string; eventId: number; folio: string; totalAmount: number }>
  >`
    SELECT DISTINCT ON (l.event_id, s.id)
      l.event_id AS "eventId",
      s.id AS "dteSaleDetailId",
      s.folio AS "folio",
      COALESCE(s.total_amount, 0)::float AS "totalAmount"
    FROM event_dte_sale_links l
    JOIN events e ON e.id = l.event_id
    JOIN dte_sale_details s ON s.id = l.dte_sale_detail_id
    WHERE e.clinical_series_id = ANY(${seriesIds})
      AND l.status != 'REJECTED'
    ORDER BY l.event_id, s.id, l.updated_at DESC
  `;
  for (const row of eventDocumentRows) {
    const documents = documentsByEventId.get(row.eventId) ?? [];
    documents.push({
      dteSaleDetailId: row.dteSaleDetailId,
      folio: row.folio,
      totalAmount: row.totalAmount,
    });
    documentsByEventId.set(row.eventId, documents);
  }

  return result;
}
