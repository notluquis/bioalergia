import { Button, Spinner } from "@heroui/react";
import type { CompanyDto } from "@finanzas/orpc-contracts/quotes";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { QuoteEditor, type QuoteEditorPayload } from "@/features/quotes/components/QuoteEditor";
import { createQuote, getCompany, quotesKeys } from "@/features/quotes/api";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

export const Route = createFileRoute("/_authed/quotes/new")({
  staticData: {
    permission: { action: "create", subject: "Quote" },
    title: "Nueva cotización",
    hideFromNav: true,
  },
  validateSearch: (search: Record<string, unknown>): { companyId?: number } => {
    const raw = search.companyId;
    const companyId = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(companyId) && companyId > 0 ? { companyId } : {};
  },
  component: NewQuotePage,
});

function NewQuotePage() {
  const navigate = useNavigate();
  const { companyId: presetCompanyId } = Route.useSearch();

  const presetQuery = useQuery({
    queryKey: quotesKeys.company(presetCompanyId ?? 0),
    queryFn: () => getCompany(presetCompanyId as number),
    enabled: Boolean(presetCompanyId),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: QuoteEditorPayload) => createQuote(payload),
    onSuccess: (quote) => {
      toast.success(`Cotización N° ${quote.folio} creada`);
      void navigate({ to: "/quotes/$id", params: { id: String(quote.id) } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo crear"),
  });

  const presetCompany: CompanyDto | null = presetQuery.data ?? null;
  const waitingPreset = Boolean(presetCompanyId) && presetQuery.isLoading;

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6">
        <Button
          variant="outline"
          className="gap-2"
          onPress={() => void navigate({ to: "/quotes" })}
        >
          <ChevronLeft size={20} /> Volver
        </Button>
      </div>

      {waitingPreset ? (
        <Spinner aria-label="Cargando empresa" />
      ) : (
        <QuoteEditor
          presetCompany={presetCompany}
          submitLabel="Guardar cotización"
          isPending={saveMutation.isPending}
          onSubmit={(payload) => saveMutation.mutate(payload)}
        />
      )}
    </div>
  );
}
