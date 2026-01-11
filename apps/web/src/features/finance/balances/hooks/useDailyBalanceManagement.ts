import { useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { logger } from "@/lib/logger";

import { saveBalance } from "../api";
import type { BalanceDraft } from "../types";
import { parseBalanceInput } from "../utils";

interface UseDailyBalanceManagementProps {
  loadBalances: () => Promise<void>;
}

export function useDailyBalanceManagement({ loadBalances }: UseDailyBalanceManagementProps) {
  const { can } = useAuth();
  const { error: showError } = useToast();
  const canEdit = can("update", "Transaction");

  const [drafts, setDrafts] = useState<Record<string, BalanceDraft>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const handleDraftChange = (date: string, patch: Partial<BalanceDraft>) => {
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
  };

  const handleSave = async (date: string) => {
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
      await loadBalances();
      logger.info("[balances] save:success", { date, balance: parsedValue });
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "No se pudo guardar el saldo diario";
      setError(message);
      showError(message);
      logger.error("[balances] save:error", message);
    } finally {
      setSaving((prev) => ({ ...prev, [date]: false }));
    }
  };

  return { drafts, saving, error, handleDraftChange, handleSave, setError, setDrafts };
}
