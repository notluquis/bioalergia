import dayjs from "dayjs";
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
  const [error, setError] = useState<null | string>(null);

  const handleDraftChange = (date: Date, patch: Partial<BalanceDraft>) => {
    const dateKey = dayjs(date).format("YYYY-MM-DD");
    setDrafts((prev) => {
      const previous = prev[dateKey] ?? { note: "", value: "" };
      return {
        ...prev,
        [dateKey]: {
          note: patch.note ?? previous.note,
          value: patch.value ?? previous.value,
        },
      };
    });
  };

  const handleSave = async (date: Date) => {
    if (!canEdit) return;
    const dateKey = dayjs(date).format("YYYY-MM-DD");
    const draft = drafts[dateKey];
    if (!draft) return;

    const parsedValue = parseBalanceInput(draft.value);
    if (parsedValue == null) {
      setError("Ingresa un saldo válido antes de guardar");
      return;
    }

    setSaving((prev) => ({ ...prev, [dateKey]: true }));
    setError(null);
    try {
      await saveBalance(dateKey, parsedValue, draft.note);
      await loadBalances();
      logger.info("[balances] save:success", { balance: parsedValue, date: dateKey });
    } catch (error_) {
      const message =
        error_ instanceof Error ? error_.message : "No se pudo guardar el saldo diario";
      setError(message);
      showError(message);
      logger.error("[balances] save:error", message);
    } finally {
      setSaving((prev) => ({ ...prev, [dateKey]: false }));
    }
  };

  return { drafts, error, handleDraftChange, handleSave, saving, setDrafts, setError };
}
