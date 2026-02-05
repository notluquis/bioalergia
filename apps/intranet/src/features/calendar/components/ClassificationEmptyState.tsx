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
  if (loading || eventsCount > 0 || error) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-success/5 py-16 ring-1 ring-success-soft-hover">
      <div className="mb-4 rounded-full bg-success/10 p-4">
        <svg
          aria-hidden="true"
          className="h-8 w-8 text-success"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </div>
      <h3 className="font-semibold text-lg text-success">¡Todo clasificado!</h3>
      <p className="mt-1 text-default-500 text-sm">No hay eventos pendientes de clasificar.</p>
    </div>
  );
}
