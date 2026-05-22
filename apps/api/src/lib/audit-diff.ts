import { type AuditEventKind, logAuditEvent } from "./audit-log.ts";

// Auditoría de cambios fila-a-fila (diff antes/después) sobre el AuditLog
// HMAC-chained, vía `logAuditEvent` (db.auditLog.create — ZenStack puro).
// Best-effort: NUNCA rompe el flujo de negocio. Solo audita cuando:
//   - hay un estado previo (oldRow != null) → no audita inserts puros, y
//   - al menos un campo observado cambió de verdad.
//
// IMPORTANTE: cuando la mutación corre dentro de una transacción, llamar a
// `auditRowChange` DESPUÉS de que la transacción commitea (no dentro), para no
// dejar un audit huérfano si la tx hace rollback. Patrón: acumular en un
// `AuditRowChangeInput[]` dentro de la tx y vaciarlo (`flushRowChangeAudits`)
// al resolver con éxito.

type Row = Record<string, unknown>;

export interface AuditRowChangeInput {
  kind: AuditEventKind;
  resource: string;
  resourceId: number | string | null;
  /** Estado previo. `null` ⇒ insert puro ⇒ no se audita. */
  oldRow: Row | null;
  newRow: Row;
  /** Campos a vigilar. Por defecto, todas las keys de `newRow`. */
  fields?: string[];
  userId?: number | null;
  ip?: string | null;
  actorLabel?: string | null;
}

function jsonEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Aplana valores a JSON-safe (Date → ISO, etc.) para la columna jsonb. */
function jsonSafe(value: Row): Row {
  return JSON.parse(JSON.stringify(value)) as Row;
}

export async function auditRowChange(input: AuditRowChangeInput): Promise<void> {
  if (input.oldRow == null) return; // insert puro: no es un cambio auditable

  const fields = input.fields ?? Object.keys(input.newRow);
  const changed: string[] = [];
  const oldVals: Row = {};
  const newVals: Row = {};

  for (const field of fields) {
    const before = input.oldRow[field];
    const after = input.newRow[field];
    if (!jsonEq(before, after)) {
      changed.push(field);
      oldVals[field] = before;
      newVals[field] = after;
    }
  }

  if (changed.length === 0) return;

  await logAuditEvent({
    kind: input.kind,
    resource: input.resource,
    resourceId: input.resourceId,
    userId: input.userId ?? null,
    actorLabel: input.actorLabel ?? null,
    ip: input.ip ?? null,
    outcome: "ok",
    message: `${changed.length} campo(s) cambiado(s): ${changed.join(", ")}`,
    metadata: { changed, new: jsonSafe(newVals), old: jsonSafe(oldVals) },
  });
}

/** Vacía una cola de diffs acumulada dentro de una tx, DESPUÉS del commit. */
export async function flushRowChangeAudits(pending: AuditRowChangeInput[]): Promise<void> {
  for (const entry of pending) {
    await auditRowChange(entry);
  }
}
