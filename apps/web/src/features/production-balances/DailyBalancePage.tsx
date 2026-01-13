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

import Alert from "@/components/ui/Alert";
import { useAuth } from "@/context/AuthContext";

import { CierrePanel } from "./components/CierrePanel";
import { EntryForm } from "./components/EntryForm";
import { TopBar } from "./components/TopBar";
import { WeekStrip } from "./components/WeekStrip";
import { useDailyBalanceForm } from "./hooks/useDailyBalanceForm";

export default function DailyBalancePage() {
  const { can } = useAuth();
  const canView = can("read", "DailyBalance");

  const {
    selectedDate,
    formData,
    isLoading,
    isSaving,
    lastSaved,
    summary,
    status,
    weekData,
    updateField,
    save,
    finalize,
    selectDate,
    goToPrevWeek,
    goToNextWeek,
    goToToday,
  } = useDailyBalanceForm();

  if (!canView) {
    return (
      <div className="p-6">
        <Alert variant="error">No tienes permisos para ver los balances diarios.</Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sticky TopBar */}
      <TopBar
        date={selectedDate}
        status={status}
        isSaving={isSaving}
        onSave={save}
        onFinalize={finalize}
        canFinalize={summary.cuadra && summary.totalMetodos > 0}
        onPrevWeek={goToPrevWeek}
        onNextWeek={goToNextWeek}
      />

      {/* Week Navigation */}
      <WeekStrip
        currentDate={selectedDate}
        weekData={weekData}
        onSelectDate={selectDate}
        onPrevWeek={goToPrevWeek}
        onNextWeek={goToNextWeek}
        onGoToToday={goToToday}
      />

      {/* Main Content: 2-column layout */}
      <div className="grid flex-1 gap-4 lg:grid-cols-12">
        {/* Entry Form - main column */}
        <div className="lg:col-span-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : (
            <EntryForm values={formData} onChange={updateField} disabled={isSaving} />
          )}
        </div>

        {/* CierrePanel - sticky sidebar */}
        <div className="lg:col-span-4">
          <CierrePanel
            summary={summary}
            status={status}
            lastSaved={lastSaved}
            isSaving={isSaving}
            onSaveDraft={save}
            onFinalize={finalize}
          />
        </div>
      </div>
    </div>
  );
}
