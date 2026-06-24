import { db } from "@finanzas/db";
import type {
  CloseNonconformityInput,
  CreateOperationalRegisterInput,
  ListOperationalRegistersInput,
} from "@finanzas/orpc-contracts/operational-registers";
import { DomainError } from "../lib/errors.ts";
import { logEvent } from "../lib/logger.ts";

/**
 * Registros operativos / sanitarios (DS 283, BIO-RG-001, REAS DS 6/2009,
 * DS 44/2024). Un único modelo `OperationalRegister` cubre los 7 tipos; los
 * campos específicos por tipo se guardan en la columna `data` (Json). Sólo
 * NONCONFORMITY usa `status` (OPEN | IN_PROGRESS | CLOSED) y `dueAt` (plazo CAPA).
 */

type RowDraft = {
  registerType: string;
  occurredAt: Date;
  summary: string;
  data: Record<string, unknown>;
  status: string | null;
  dueAt: Date | null;
  signedBy: string | null;
};

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

// Convierte la variante de la unión discriminada en una fila. `summary` es una
// etiqueta humana corta derivada del tipo + campos clave. `data` guarda sólo los
// campos específicos del tipo (sin los comunes occurredAt/registerType).
function toRowDraft(input: CreateOperationalRegisterInput): RowDraft {
  const occurredAt = new Date(input.occurredAt);
  const base = {
    occurredAt,
    status: null as string | null,
    dueAt: null as Date | null,
    signedBy: null as string | null,
  };

  switch (input.registerType) {
    case "COLD_CHAIN": {
      const data: Record<string, unknown> = {
        tempC: input.tempC,
        withinRange: input.withinRange,
      };
      if (input.minC !== undefined) data.minC = input.minC;
      if (input.maxC !== undefined) data.maxC = input.maxC;
      if (input.correctiveAction !== undefined) data.correctiveAction = input.correctiveAction;
      if (input.notes !== undefined) data.notes = input.notes;
      return {
        ...base,
        registerType: input.registerType,
        summary: `Temp ${round1(input.tempC)}C (${input.withinRange ? "en rango" : "fuera de rango"})`,
        data,
      };
    }
    case "REAS": {
      const data: Record<string, unknown> = {
        movement: input.movement,
        wasteType: input.wasteType,
        quantityKg: input.quantityKg,
      };
      if (input.destination !== undefined) data.destination = input.destination;
      if (input.guideNumber !== undefined) data.guideNumber = input.guideNumber;
      if (input.notes !== undefined) data.notes = input.notes;
      return {
        ...base,
        registerType: input.registerType,
        summary: `${input.movement === "INGRESO" ? "Ingreso" : "Retiro"} ${input.wasteType} ${round1(input.quantityKg)} kg`,
        data,
      };
    }
    case "TRAINING": {
      const data: Record<string, unknown> = {
        topic: input.topic,
        attendees: input.attendees,
      };
      if (input.facilitator !== undefined) data.facilitator = input.facilitator;
      if (input.durationHours !== undefined) data.durationHours = input.durationHours;
      if (input.notes !== undefined) data.notes = input.notes;
      return {
        ...base,
        registerType: input.registerType,
        summary: `Capacitación: ${input.topic} (${input.attendees.length} asistentes)`,
        data,
      };
    }
    case "EPP_DELIVERY": {
      const data: Record<string, unknown> = {
        item: input.item,
        recipient: input.recipient,
        quantity: input.quantity,
      };
      if (input.notes !== undefined) data.notes = input.notes;
      return {
        ...base,
        registerType: input.registerType,
        signedBy: input.signedBy?.trim() || null,
        summary: `Entrega EPP: ${input.quantity} x ${input.item} a ${input.recipient}`,
        data,
      };
    }
    case "OMPP": {
      const data: Record<string, unknown> = {
        procedure: input.procedure,
        delegatedTo: input.delegatedTo,
      };
      if (input.validUntil !== undefined) data.validUntil = input.validUntil;
      if (input.notes !== undefined) data.notes = input.notes;
      return {
        ...base,
        registerType: input.registerType,
        signedBy: input.signedBy?.trim() || null,
        summary: `OMPP: ${input.procedure} → ${input.delegatedTo}`,
        data,
      };
    }
    case "R_AIT": {
      const data: Record<string, unknown> = {
        patientRef: input.patientRef,
        allergen: input.allergen,
        dose: input.dose,
      };
      if (input.reaction !== undefined) data.reaction = input.reaction;
      if (input.observationMin !== undefined) data.observationMin = input.observationMin;
      if (input.notes !== undefined) data.notes = input.notes;
      return {
        ...base,
        registerType: input.registerType,
        summary: `R-AIT: ${input.patientRef} — ${input.allergen} ${input.dose}`,
        data,
      };
    }
    case "NONCONFORMITY": {
      const data: Record<string, unknown> = {
        description: input.description,
      };
      if (input.rootCause !== undefined) data.rootCause = input.rootCause;
      if (input.action !== undefined) data.action = input.action;
      if (input.responsible !== undefined) data.responsible = input.responsible;
      if (input.notes !== undefined) data.notes = input.notes;
      return {
        ...base,
        registerType: input.registerType,
        status: "OPEN",
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        summary: `No conformidad: ${input.description.slice(0, 80)}`,
        data,
      };
    }
  }
}

export async function listOperationalRegisters(input: ListOperationalRegistersInput): Promise<{
  registers: Awaited<ReturnType<typeof db.operationalRegister.findMany>>;
}> {
  const where: { registerType?: string; status?: string } = {};
  if (input.registerType) where.registerType = input.registerType;
  if (input.status) where.status = input.status;

  const registers = await db.operationalRegister.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { occurredAt: "desc" },
  });
  return { registers };
}

export async function createOperationalRegister(
  input: CreateOperationalRegisterInput,
  recordedBy: number
) {
  const draft = toRowDraft(input);
  const register = await db.operationalRegister.create({
    data: {
      registerType: draft.registerType,
      occurredAt: draft.occurredAt,
      summary: draft.summary,
      data: draft.data as never,
      status: draft.status,
      dueAt: draft.dueAt,
      signedBy: draft.signedBy,
      recordedBy,
    },
  });
  logEvent("[operational-registers] register created", {
    id: register.id,
    type: register.registerType,
  });
  return register;
}

export async function closeNonconformity(input: CloseNonconformityInput) {
  const found = await db.operationalRegister.findUnique({
    where: { id: input.id },
    select: { id: true, registerType: true, data: true },
  });
  if (!found || found.registerType !== "NONCONFORMITY") {
    throw new DomainError("NOT_FOUND", "No conformidad no encontrada");
  }

  const prevData =
    found.data && typeof found.data === "object" && !Array.isArray(found.data)
      ? (found.data as Record<string, unknown>)
      : {};
  const data: Record<string, unknown> = { ...prevData };
  if (input.resolution !== undefined) data.resolution = input.resolution;

  return db.operationalRegister.update({
    where: { id: input.id },
    data: {
      status: input.status,
      data: data as never,
    },
  });
}
