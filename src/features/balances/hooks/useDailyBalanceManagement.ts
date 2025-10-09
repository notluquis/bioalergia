import { useCallback, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { logger } from "../../../lib/logger";
import { parseBalanceInput } from "../utils";
import { saveBalance } from "../api";
import type { BalanceDraft } from "../types";

interface UseDailyBalanceManagementProps {
  from: string;
  to: string;
  loadBalances: (from: string, to: string) => Promise<void>;
}

export function useDailyBalanceManagement({ from, to, loadBalances }: UseDailyBalanceManagementProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole("GOD", "ADMIN", "ANALYST");

  const [drafts, setDrafts] = useState<Record<string, BalanceDraft>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const handleDraftChange = useCallback((date: string, patch: Partial<BalanceDraft>) => {
    setDrafts((prev) => {
      const previous = prev[date] ?? { value: "", note: "" };
      return {
        ...prev,
        [date]: {
          value: patch.value ?? previous.value,
          note: patch.note ?? previous.note,
        },
      };
    });
  }, []);

  const handleSave = useCallback(
    async (date: string) => {
      if (!canEdit) return;
      const draft = drafts[date];
      if (!draft) return;

      const parsedValue = parseBalanceInput(draft.value);
      if (parsedValue == null) {
        setError("Ingresa un saldo válido antes de guardar");
        return;
      }

      setSaving((prev) => ({ ...prev, [date]: true }));
      setError(null);
      try {
        await saveBalance(date, parsedValue, draft.note);
        await loadBalances(from, to);
        logger.info("[balances] save:success", { date, balance: parsedValue });
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo guardar el saldo diario";
        setError(message);
        logger.error("[balances] save:error", message);
      } finally {
        setSaving((prev) => ({ ...prev, [date]: false }));
      }
    },
    [canEdit, drafts, from, to, loadBalances]
  );

  return { drafts, saving, error, handleDraftChange, handleSave, setError, setDrafts };
}
