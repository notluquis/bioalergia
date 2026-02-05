import { RefreshCw } from "lucide-react";
import Button from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import type { ReclassifyJob } from "../types";

interface ClassificationToolbarProps {
  isJobRunning: boolean;
  job: ReclassifyJob | null;
  loading: boolean;
  onReclassify: () => void;
  onReclassifyAll: () => void;
  onRefetch: () => void;
  progress: number;
  reclassifyAllPending: boolean;
  reclassifyPending: boolean;
}

export function ClassificationToolbar({
  loading,
  onRefetch,
  isJobRunning,
  progress,
  job,
  onReclassify,
  onReclassifyAll,
  reclassifyPending,
  reclassifyAllPending,
}: ClassificationToolbarProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Refresh Button */}
      <Button
        className="gap-2 text-default-600"
        isDisabled={loading}
        onClick={onRefetch}
        size="sm"
        title="Actualizar lista"
        type="button"
        variant="ghost"
      >
        <svg
          aria-hidden="true"
          className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
        <span className="hidden sm:inline">{loading ? "Cargando..." : "Actualizar"}</span>
      </Button>

      {/* Action Buttons */}
      <Button
        className="relative gap-2 overflow-hidden"
        disabled={reclassifyPending || isJobRunning}
        onClick={onReclassify}
        type="button"
        variant="tertiary"
      >
        {isJobRunning && (
          <div
            className="absolute inset-0 bg-primary/20 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          {isJobRunning ? (
            <>
              <svg
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
              <span className="tabular-nums">{progress}%</span>
            </>
          ) : (
            <>
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
              Reclasificar pendientes
            </>
          )}
        </span>
      </Button>

      {/* Progress info pill */}
      {isJobRunning && job && (
        <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5">
          <span className="font-medium text-primary/80 text-xs">{job.message}</span>
          <span className="font-bold text-primary text-xs tabular-nums">
            {job.progress.toLocaleString("es-CL")}/{job.total.toLocaleString("es-CL")}
          </span>
        </div>
      )}

      <Tooltip
        classNames={{
          content: "bg-default-100 rounded-lg px-3 py-2 text-xs shadow-xl",
        }}
        content="Reclasificar TODO (sobrescribe existentes)"
        placement="bottom"
        showArrow
      >
        <Button
          aria-label="Reclasificar todo"
          isDisabled={reclassifyAllPending || isJobRunning}
          isIconOnly
          onPress={onReclassifyAll}
          size="sm"
          variant="ghost"
        >
          <RefreshCw className={isJobRunning ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </Tooltip>
    </div>
  );
}
