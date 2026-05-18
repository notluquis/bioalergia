import { Alert, Button, Card, Skeleton } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { catalogORPCClient } from "@/features/catalog/orpc";

const PENDING_KEY = ["catalog", "reviews", "pending"] as const;

function StarRow({ value }: { value: number }) {
  return (
    <span aria-label={`${value} de 5 estrellas`} className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < value;
        return (
          <Star
            aria-hidden="true"
            className={filled ? "fill-warning text-warning" : "text-foreground/30"}
            key={i}
            size={14}
          />
        );
      })}
    </span>
  );
}

export function ReviewsModerationPage() {
  const queryClient = useQueryClient();
  const pendingQ = useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => catalogORPCClient.pendingReviews(),
  });

  const moderateMutation = useMutation({
    mutationFn: (input: { id: number; status: "APPROVED" | "REJECTED" }) =>
      catalogORPCClient.moderateReview(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PENDING_KEY });
    },
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-bold text-3xl">Reseñas pendientes</h1>
        <p className="text-foreground/60 text-sm">
          Aprueba o rechaza reseñas enviadas por clientes. Las aprobadas aparecen públicamente en la
          ficha del producto.
        </p>
      </header>

      {pendingQ.isLoading && <Skeleton className="h-32 w-full" />}

      {pendingQ.isSuccess && pendingQ.data.data.length === 0 && (
        <Alert status="success">
          <Alert.Content>
            <Alert.Description>No hay reseñas pendientes de moderación.</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="space-y-3">
        {pendingQ.data?.data.map((r) => (
          <Card key={r.id}>
            <Card.Header>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Card.Title>{r.product.name}</Card.Title>
                <span className="text-foreground/50 text-xs">
                  {new Date(r.created_at).toLocaleString("es-CL")}
                </span>
              </div>
              <Card.Description>
                {r.author_name}
                {r.author_email ? ` · ${r.author_email}` : ""}
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-2">
              <StarRow value={r.rating} />
              {r.title && <p className="font-semibold">{r.title}</p>}
              <p className="whitespace-pre-line text-foreground/80 text-sm">{r.body}</p>
              <div className="flex gap-2 pt-2">
                <Button
                  isDisabled={moderateMutation.isPending}
                  onPress={() => moderateMutation.mutate({ id: r.id, status: "APPROVED" })}
                  variant="primary"
                >
                  Aprobar
                </Button>
                <Button
                  isDisabled={moderateMutation.isPending}
                  onPress={() => moderateMutation.mutate({ id: r.id, status: "REJECTED" })}
                  variant="danger"
                >
                  Rechazar
                </Button>
              </div>
            </Card.Content>
          </Card>
        ))}
      </div>
    </div>
  );
}
