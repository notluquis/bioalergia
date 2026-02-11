/**
 * Daily Balance - Main Page Component
 *
 * Redesigned with:
 * - Sticky TopBar with date and actions
 * - WeekStrip navigation
 * - Two-column layout: EntryForm + CierrePanel
 * - Keyboard shortcuts (⌘S)
 * - Autosave
 */

import { Spinner } from "@heroui/react";

import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/context/AuthContext";

import { CierrePanel } from "./components/CierrePanel";
import { EntryForm } from "./components/EntryForm";
import { TopBar } from "./components/TopBar";
import { WeekStrip } from "./components/WeekStrip";
import { useDailyBalanceForm } from "./hooks/use-daily-balance-form";
export function DailyBalancePage() {
  const { can } = useAuth();
  const canView = can("read", "DailyBalance");

  const {
    finalize,
    formData,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    isLoading,
    isSaving,
    lastSaved,
    save,
    selectDate,
    selectedDate,
    status,
    summary,
    updateField,
    weekData,
  } = useDailyBalanceForm();

  if (!canView) {
    return (
      <div className="p-6">
        <Alert status="danger">No tienes permisos para ver los balances diarios.</Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sticky TopBar */}
      <TopBar
        canFinalize={summary.cuadra && summary.totalMetodos > 0}
        date={selectedDate}
        isSaving={isSaving}
        onFinalize={finalize}
        onSave={save}
        status={status}
      />

      {/* Week Navigation */}
      <WeekStrip
        currentDate={selectedDate}
        onGoToToday={goToToday}
        onNextWeek={goToNextWeek}
        onPrevWeek={goToPrevWeek}
        onSelectDate={selectDate}
        weekData={weekData}
      />

      {/* Main Content: 2-column layout */}
      <div className="grid flex-1 gap-4 lg:grid-cols-12">
        {/* Entry Form - main column */}
        <div className="lg:col-span-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <EntryForm disabled={isSaving} onChange={updateField} values={formData} />
          )}
        </div>

        {/* CierrePanel - sticky sidebar */}
        <div className="lg:col-span-4">
          <CierrePanel
            isSaving={isSaving}
            lastSaved={lastSaved}
            onFinalize={finalize}
            onSaveDraft={save}
            status={status}
            summary={summary}
          />
        </div>
      </div>
    </div>
  );
}
