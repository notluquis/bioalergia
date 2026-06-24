/**
 * Daily Balance - Main Page Component
 *
 * - Sticky TopBar con fecha, estado y guardar (⌘S)
 * - WeekStrip de navegación semanal
 * - Dos columnas: EntryForm + CierrePanel
 * - Autosave (solo días en borrador)
 */

import { Button } from "@heroui/react";

import { CierrePanel } from "./components/CierrePanel";
import { EntryForm } from "./components/EntryForm";
import { TopBar } from "./components/TopBar";
import { WeekStrip } from "./components/WeekStrip";
import { useDailyBalanceForm } from "./hooks/use-daily-balance-form";

export function DailyBalancePage() {
  const {
    finalize,
    formData,
    goToNextWeek,
    goToPrevWeek,
    goToToday,
    isFinalized,
    isSaving,
    lastSaved,
    reopen,
    save,
    selectDate,
    selectedDate,
    status,
    summary,
    updateField,
    weekData,
  } = useDailyBalanceForm();

  return (
    <div className="flex h-full flex-col">
      {/* Sticky TopBar */}
      <TopBar
        date={selectedDate}
        isFinalized={isFinalized}
        isSaving={isSaving}
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
      <div className="grid flex-1 gap-4 pb-24 lg:grid-cols-12 lg:pb-0">
        {/* Entry Form - main column */}
        <div className="lg:col-span-8">
          <EntryForm disabled={isSaving || isFinalized} onChange={updateField} values={formData} />
        </div>

        {/* CierrePanel - sticky sidebar */}
        <div className="lg:col-span-4">
          <CierrePanel
            isFinalized={isFinalized}
            isSaving={isSaving}
            lastSaved={lastSaved}
            onFinalize={finalize}
            onReopen={reopen}
            status={status}
            summary={summary}
          />
        </div>
      </div>

      {/* Mobile actions: single sticky CTA area to avoid duplicated primaries */}
      <div className="sticky bottom-0 z-20 mt-4 border-default-200 border-t bg-background/95 p-3 backdrop-blur-md lg:hidden">
        <div className="flex gap-2">
          {isFinalized ? (
            <Button
              className="flex-1 rounded-xl"
              isDisabled={isSaving}
              onPress={() => {
                void reopen();
              }}
              variant="outline"
            >
              Reabrir día
            </Button>
          ) : (
            <>
              <Button
                className="flex-1 rounded-xl"
                isDisabled={isSaving}
                isPending={isSaving}
                onPress={save}
                variant="outline"
              >
                Guardar
              </Button>
              <Button
                className="flex-1 rounded-xl"
                isDisabled={!summary.cuadra || summary.totalMetodos <= 0 || isSaving}
                onPress={() => {
                  void finalize();
                }}
              >
                Finalizar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
