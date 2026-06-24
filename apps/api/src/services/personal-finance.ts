import type { authDb } from "@finanzas/db";
import type {
  personalFinanceCreateCreditInputSchema,
  personalFinancePayInstallmentInputSchema,
} from "@finanzas/orpc-contracts/personal-finance";
import { Decimal } from "decimal.js";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { instantToChileDate, isoToDbDate } from "../lib/time.ts";
import { getUFValue } from "./cmf-uf.ts";

// Lógica de negocio de créditos personales, fuera de los handlers oRPC. Los
// handlers conservan el authz guard (getAuthorizedDb → $setAuth con la policy
// por-usuario) y pasan el cliente ZenStack YA scopeado a estas funciones, de
// modo que el boundary de seguridad (PolicyPlugin) es idéntico al previo: misma
// instancia, mismo $setAuth, mismas queries. Los servicios sólo validan y
// lanzan DomainError (mapeado a HTTP por orpc/error.ts::toORPCError vía el
// SuperJSONRPCHandler). Math monetaria movida VERBATIM (Decimal, redondeo,
// orden de agregación intactos).

// Cliente ZenStack scopeado por la policy del usuario autenticado. Es lo que
// devuelve `authDb.$setAuth(authContext)` en el handler — la fuente del
// per-user scoping. El servicio NO lo crea; lo recibe ya autenticado.
type AuthorizedDb = ReturnType<typeof authDb.$setAuth>;

type CreateCreditInput = z.infer<typeof personalFinanceCreateCreditInputSchema>;
type PayInstallmentInput = z.infer<typeof personalFinancePayInstallmentInputSchema>;

function parseDateOnlyUtc(value: string): Date {
  return isoToDbDate(value);
}

// ─── Backfill UF→CLP ────────────────────────────────────────────────────────

export interface BackfillUfClpResult {
  processed: number;
  results: Array<{
    creditId: number;
    installmentNumber: number;
    paidAmount: number;
    paidAmountCLP: number;
    paymentDate: string;
    ufValue: number;
  }>;
}

export async function backfillUfClp(db: AuthorizedDb): Promise<BackfillUfClpResult> {
  const creditsUF = await db.personalCredit.findMany({
    where: { currency: "UF" },
    include: {
      installments: {
        where: {
          paidAt: { not: null },
          status: "PAID",
        },
      },
    },
  });

  const results: BackfillUfClpResult["results"] = [];

  for (const credit of creditsUF) {
    for (const installment of credit.installments || []) {
      if (!installment.paidAt || !installment.paidAmount) {
        continue;
      }

      try {
        const paymentDate = instantToChileDate(installment.paidAt) ?? "";
        const ufValue = await getUFValue(paymentDate);
        const paidAmountCLP = installment.paidAmount.times(ufValue);

        await db.personalCreditInstallment.update({
          where: { id: installment.id },
          data: { paidAmountCLP },
        });

        results.push({
          creditId: credit.id,
          installmentNumber: installment.installmentNumber,
          paidAmount: Number(installment.paidAmount),
          paidAmountCLP: Number(paidAmountCLP),
          paymentDate,
          ufValue,
        });
      } catch (error) {
        console.error(`[Backfill] Error processing installment ${installment.id}:`, error);
      }
    }
  }

  return {
    processed: results.length,
    results,
  };
}

// ─── Credit CRUD ────────────────────────────────────────────────────────────

export async function createCredit(db: AuthorizedDb, input: CreateCreditInput) {
  return db.personalCredit.create({
    data: {
      bankName: input.bankName,
      creditNumber: input.creditNumber,
      description: input.description,
      totalAmount: new Decimal(input.totalAmount),
      currency: input.currency,
      interestRate: input.interestRate ? new Decimal(input.interestRate) : undefined,
      startDate: parseDateOnlyUtc(input.startDate),
      totalInstallments: input.totalInstallments,
      status: "ACTIVE",
      installments: {
        create: input.installments?.map(
          (installment: NonNullable<typeof input.installments>[number]) => ({
            installmentNumber: installment.installmentNumber,
            dueDate: parseDateOnlyUtc(installment.dueDate),
            amount: new Decimal(installment.amount),
            capitalAmount: installment.capitalAmount
              ? new Decimal(installment.capitalAmount)
              : undefined,
            interestAmount: installment.interestAmount
              ? new Decimal(installment.interestAmount)
              : undefined,
            otherCharges: installment.otherCharges
              ? new Decimal(installment.otherCharges)
              : undefined,
            status: "PENDING",
          })
        ),
      },
    },
    include: {
      installments: true,
    },
  });
}

export async function deleteCredit(db: AuthorizedDb, id: number): Promise<void> {
  await db.personalCredit.delete({
    where: { id },
  });
}

// Devuelve el crédito o lanza DomainError("NOT_FOUND") con el mismo mensaje que
// usaba el handler. El per-user scoping lo aplica `db` (cliente $setAuth).
export async function getCreditOrThrow(db: AuthorizedDb, id: number) {
  const credit = await db.personalCredit.findUnique({
    where: { id },
    include: {
      installments: {
        orderBy: { installmentNumber: "asc" },
      },
    },
  });

  if (!credit) {
    throw new DomainError("NOT_FOUND", "Credit not found");
  }

  return credit;
}

export async function listCredits(db: AuthorizedDb) {
  return db.personalCredit.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      installments: {
        orderBy: { installmentNumber: "asc" },
      },
    },
  });
}

// ─── Pay installment ──────────────────────────────────────────────────────────

export async function payInstallment(db: AuthorizedDb, input: PayInstallmentInput) {
  const installment = await db.personalCreditInstallment.findUnique({
    where: {
      creditId_installmentNumber: {
        creditId: input.creditId,
        installmentNumber: input.installmentNumber,
      },
    },
    include: {
      credit: true,
    },
  });

  if (!installment) {
    throw new DomainError("NOT_FOUND", "Installment not found");
  }

  if (installment.status === "PAID") {
    throw new DomainError("BAD_REQUEST", "Installment already paid");
  }

  let paidAmountCLP: Decimal | null = null;

  if (installment.credit.currency === "UF") {
    try {
      const ufValue = await getUFValue(input.paymentDate);
      paidAmountCLP = new Decimal(input.amount).times(ufValue);
    } catch (error) {
      console.error("[Payment] Error calculating CLP equivalent:", error);
    }
  }

  const updated = await db.personalCreditInstallment.update({
    where: { id: installment.id },
    data: {
      status: "PAID",
      paidAt: parseDateOnlyUtc(input.paymentDate),
      paidAmount: new Decimal(input.amount),
      paidAmountCLP,
    },
  });

  const pendingInstallments = await db.personalCreditInstallment.count({
    where: {
      creditId: input.creditId,
      status: "PENDING",
    },
  });

  if (pendingInstallments === 0) {
    await db.personalCredit.update({
      where: { id: input.creditId },
      data: { status: "PAID" },
    });
  }

  return updated;
}
