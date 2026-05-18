import { Alert, Skeleton } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";

import { accountKeys } from "@/features/account/queries";
import { siteAuthClient } from "@/lib/orpc-client";

const searchSchema = z.object({ token: z.string().min(8) });

function AuthCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = Route.useSearch();
  const triggered = useRef(false);

  const mutation = useMutation({
    mutationFn: () => siteAuthClient.consumeMagicLink({ token }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accountKeys.all });
      navigate({ to: "/mi-cuenta", replace: true });
    },
  });

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    mutation.mutate();
    // Intentionally only run once on mount — mutation reference is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8 sm:px-6">
      <h1 className="font-bold text-2xl">Verificando acceso…</h1>
      {mutation.isError ? (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>Enlace inválido o expirado</Alert.Title>
            <Alert.Description>
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Solicita un nuevo enlace desde la pantalla de inicio de sesión."}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : (
        <Skeleton className="h-16 w-full" />
      )}
    </main>
  );
}

export const Route = createFileRoute("/mi-cuenta/auth/callback")({
  validateSearch: searchSchema,
  component: AuthCallbackPage,
});
