import { Description, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { toVerificationApiError, verificationORPCClient } from "@/features/verification/orpc";
import { formatChile } from "@/lib/dates";

// Search param opcional `h`: hash SHA-256 del PDF para el badge de integridad.
const VerificarSearchSchema = z.object({
  h: z.string().optional(),
});

const VerifyDocumentSchema = z.union([
  z.looseObject({
    valid: z.literal(true),
    documentType: z.enum(["prescription", "certificate"]),
    documentLabel: z.string(),
    issuedAt: z.union([z.string(), z.date()]),
    doctor: z.object({
      name: z.string(),
      specialty: z.string(),
    }),
    patientInitials: z.string(),
    pdfIntact: z.boolean().optional(),
  }),
  z.looseObject({
    valid: z.literal(false),
  }),
]);

export const Route = createFileRoute("/verificar/$code")({
  component: VerificarDocumentPage,
  validateSearch: (search) => VerificarSearchSchema.parse(search),
});

function VerificarDocumentPage() {
  const { code } = Route.useParams();
  const { h } = Route.useSearch();

  const { data, isLoading, error } = useQuery({
    queryKey: ["verificar-documento", code, h ?? null],
    queryFn: async () => {
      try {
        return VerifyDocumentSchema.parse(await verificationORPCClient.verify({ code, h }));
      } catch (err) {
        throw toVerificationApiError(err);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-2xl space-y-4 rounded-2xl bg-background p-8 shadow-xl">
          <Skeleton className="mx-auto h-10 w-56 rounded-lg" />
          <Skeleton className="h-6 w-2/3 rounded-md" />
          <Skeleton className="h-6 w-3/4 rounded-md" />
          <Skeleton className="h-6 w-1/2 rounded-md" />
          <Description className="text-foreground/70 text-sm">Verificando documento...</Description>
        </div>
      </div>
    );
  }

  if (error || !data?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-danger/10 p-4">
        <div className="max-w-md rounded-2xl bg-background p-8 text-center shadow-xl">
          <div className="mb-4 text-6xl" aria-hidden="true">
            ❌
          </div>
          <span className="mb-2 block font-bold text-3xl text-danger">Documento inválido</span>
          <Description className="text-foreground/70">
            Este documento no existe, fue anulado o el código no es correcto.
          </Description>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-success/10 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-background p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-6xl" aria-hidden="true">
            ✅
          </div>
          <span className="block font-bold text-3xl text-success">Documento válido</span>
          <Description className="mt-1 text-foreground/70">{data.documentLabel}</Description>
        </div>

        <div className="space-y-6">
          <div className="border-default-200 border-b pb-4">
            <span className="mb-1 block font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Tipo de documento
            </span>
            <span className="font-medium text-xl">{data.documentLabel}</span>
          </div>

          <div className="border-default-200 border-b pb-4">
            <span className="mb-1 block font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Paciente
            </span>
            <span className="font-medium text-xl">{data.patientInitials}</span>
            <Description className="mt-1 text-foreground/60 text-sm">
              Por privacidad, solo se muestran las iniciales del paciente.
            </Description>
          </div>

          <div className="border-default-200 border-b pb-4">
            <span className="mb-1 block font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Emitido por
            </span>
            <span className="block font-medium text-lg">{data.doctor.name}</span>
            <Description className="text-foreground/60 text-sm">
              {data.doctor.specialty}
            </Description>
          </div>

          <div>
            <span className="mb-1 block font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Fecha de emisión
            </span>
            <span className="text-lg">{formatChile(data.issuedAt, "DD [de] MMMM [de] YYYY")}</span>
          </div>

          {data.pdfIntact !== undefined && (
            <div className={`rounded-lg p-4 ${data.pdfIntact ? "bg-success/10" : "bg-warning/10"}`}>
              <span
                className={`font-medium text-sm ${data.pdfIntact ? "text-success" : "text-warning"}`}
              >
                {data.pdfIntact
                  ? "✓ El archivo PDF coincide con el original (no fue alterado)."
                  : "⚠ El archivo PDF no coincide con el original registrado."}
              </span>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-lg bg-info/10 p-4">
          <Description className="text-center text-info text-sm">
            Este documento ha sido verificado digitalmente y es auténtico.
          </Description>
        </div>
      </div>
    </div>
  );
}
