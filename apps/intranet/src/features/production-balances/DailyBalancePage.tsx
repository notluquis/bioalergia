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
import { Button } from "@/components/ui/Button";
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
      <TopBar date={selectedDate} isSaving={isSaving} onSave={save} status={status} />

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
      <div className="grid flex-1 gap-4 pb-24 lg:grid-cols-12 lg:pb-0">
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

      {/* Mobile actions: single sticky CTA area to avoid duplicated primaries */}
      <div className="sticky bottom-0 z-20 mt-4 border-default-200 border-t bg-background/95 p-3 backdrop-blur-md lg:hidden">
        <div className="flex gap-2">
          <Button
            className="flex-1 rounded-xl"
            isDisabled={isSaving}
            isLoading={isSaving}
            onPress={save}
            variant="outline"
          >
            Guardar
          </Button>
          <Button
            className="flex-1 rounded-xl"
            isDisabled={!summary.cuadra || summary.totalMetodos <= 0 || isSaving}
            onPress={finalize}
          >
            Finalizar
          </Button>
        </div>
      </div>
    </div>
  );
}
