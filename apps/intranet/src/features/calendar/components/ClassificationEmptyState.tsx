interface ClassificationEmptyStateProps {
  loading: boolean;
  eventsCount: number;
  error?: string | null;
}

export function ClassificationEmptyState({
  loading,
  eventsCount,
  error,
}: ClassificationEmptyStateProps) {
  if (loading || eventsCount > 0 || error) return null;

  return (
    <div className="bg-success/5 ring-success-soft-hover flex flex-col items-center justify-center rounded-2xl py-16 ring-1">
      <div className="bg-success/10 mb-4 rounded-full p-4">
        <svg
          aria-hidden="true"
          className="text-success h-8 w-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </div>
      <h3 className="text-success text-lg font-semibold">¡Todo clasificado!</h3>
      <p className="text-default-500 mt-1 text-sm">No hay eventos pendientes de clasificar.</p>
    </div>
  );
}
