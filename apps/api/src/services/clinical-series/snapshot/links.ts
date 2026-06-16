import { dbClinicalSeries as db } from "@finanzas/db/slices";
import { sql } from "kysely";

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

  // DISTINCT ON (e.clinical_series_id, s.id): keep, per (series, sale-detail),
  // the row from the most recently updated link. Kysely's distinctOn + the
  // leftmost orderBy mirror the original DISTINCT ON semantics exactly.
  const linkedDocumentRows = (await db.$qb
    .selectFrom("EventDteSaleLink as l")
    .innerJoin("Event as e", "e.id", "l.eventId")
    .innerJoin("DTESaleDetail as s", "s.id", "l.dteSaleDetailId")
    .where("e.clinicalSeriesId", "in", seriesIds)
    .where("l.status", "!=", "REJECTED")
    .distinctOn(["e.clinicalSeriesId", "s.id"])
    .select([
      sql<number>`e.clinical_series_id`.as("seriesId"),
      "s.id as dteSaleDetailId",
      "s.clientName as clientName",
      "s.clientRUT as clientRUT",
      sql<string>`to_char(s.document_date, 'YYYY-MM-DD')`.as("documentDate"),
      "s.folio as folio",
      sql<number>`COALESCE(s.total_amount, 0)::float`.as("totalAmount"),
      "l.matchedBy as matchedBy",
      sql<number>`l.confidence_score::float`.as("confidenceScore"),
    ])
    .orderBy("e.clinicalSeriesId")
    .orderBy("s.id")
    .orderBy("l.updatedAt", "desc")
    .execute()) as Array<ClinicalSeriesLinkedDocument & { seriesId: number }>;
  for (const row of linkedDocumentRows) {
    const { seriesId, ...document } = row;
    const entry = result.get(seriesId);
    if (entry) entry.linkedDocuments.push(document);
  }

  const eventFolioRows = (await db.$qb
    .selectFrom("EventDteSaleLink as l")
    .innerJoin("Event as e", "e.id", "l.eventId")
    .innerJoin("DTESaleDetail as s", "s.id", "l.dteSaleDetailId")
    .where("e.clinicalSeriesId", "in", seriesIds)
    .where("l.status", "!=", "REJECTED")
    .select([
      sql<number>`l.event_id`.as("eventId"),
      sql<string[]>`ARRAY_AGG(s.folio ORDER BY s.document_date)`.as("folios"),
    ])
    .groupBy("l.eventId")
    .execute()) as Array<{ eventId: number; folios: string[] }>;
  for (const row of eventFolioRows) {
    foliosByEventId.set(row.eventId, row.folios);
  }

  // DISTINCT ON (l.event_id, s.id): one row per (event, sale-detail), taking the
  // most recently updated link — same shape the per-event document map expects.
  const eventDocumentRows = (await db.$qb
    .selectFrom("EventDteSaleLink as l")
    .innerJoin("Event as e", "e.id", "l.eventId")
    .innerJoin("DTESaleDetail as s", "s.id", "l.dteSaleDetailId")
    .where("e.clinicalSeriesId", "in", seriesIds)
    .where("l.status", "!=", "REJECTED")
    .distinctOn(["l.eventId", "s.id"])
    .select([
      sql<number>`l.event_id`.as("eventId"),
      "s.id as dteSaleDetailId",
      "s.folio as folio",
      sql<number>`COALESCE(s.total_amount, 0)::float`.as("totalAmount"),
    ])
    .orderBy("l.eventId")
    .orderBy("s.id")
    .orderBy("l.updatedAt", "desc")
    .execute()) as Array<{
    dteSaleDetailId: string;
    eventId: number;
    folio: string;
    totalAmount: number;
  }>;
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
