import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";

const VerifyCertificateSchema = z.union([
  z.looseObject({
    valid: z.literal(true),
    diagnosis: z.string(),
    doctor: z.object({
      name: z.string(),
      specialty: z.string().optional(),
    }),
    issuedAt: z.string(),
    patient: z.object({
      name: z.string(),
    }),
    purpose: z.string(),
    restDays: z.number().optional(),
    restEndDate: z.string().optional(),
    restStartDate: z.string().optional(),
  }),
  z.looseObject({
    valid: z.literal(false),
    error: z.string().optional(),
  }),
]);
type VerifyCertificateResponse = z.infer<typeof VerifyCertificateSchema>;

export const Route = createFileRoute("/verify/$id")({
  component: VerifyCertificatePage,
});

function VerifyCertificatePage() {
  const { id } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["verify-certificate", id],
    queryFn: async () => {
      const data = await apiClient.get<VerifyCertificateResponse>(`certificates/verify/${id}`, {
        responseSchema: VerifyCertificateSchema,
      });
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-foreground/70">Verificando certificado...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.valid) {
    const invalidMessage =
      typeof data?.error === "string"
        ? data.error
        : "Este certificado no existe o ha sido revocado";
    return (
      <div className="flex min-h-screen items-center justify-center bg-danger/10">
        <div className="max-w-md rounded-2xl bg-background p-8 text-center shadow-xl">
          <div className="mb-4 text-6xl">❌</div>
          <h1 className="mb-2 font-bold text-3xl text-danger">Certificado Inválido</h1>
          <p className="text-foreground/70">{invalidMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-success/10 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-background p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-6xl">✅</div>
          <h1 className="font-bold text-3xl text-success">Certificado Válido</h1>
        </div>

        <div className="space-y-6">
          <div className="border-default-200 border-b pb-4">
            <h3 className="mb-1 font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Paciente
            </h3>
            <p className="font-medium text-xl">{data.patient.name}</p>
          </div>

          <div className="border-default-200 border-b pb-4">
            <h3 className="mb-1 font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Diagnóstico
            </h3>
            <p className="text-lg">{data.diagnosis}</p>
          </div>

          {data.restDays && (
            <div className="border-default-200 border-b pb-4">
              <h3 className="mb-1 font-semibold text-foreground/70 text-sm uppercase tracking-wide">
                Reposo Médico
              </h3>
              <p className="font-medium text-lg">{data.restDays} días</p>
              {data.restStartDate && data.restEndDate && (
                <p className="mt-1 text-foreground/60 text-sm">
                  Desde {dayjs(data.restStartDate).format("DD/MM/YYYY")} hasta{" "}
                  {dayjs(data.restEndDate).format("DD/MM/YYYY")}
                </p>
              )}
            </div>
          )}

          <div className="border-default-200 border-b pb-4">
            <h3 className="mb-1 font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Propósito
            </h3>
            <p className="text-lg capitalize">{data.purpose}</p>
          </div>

          <div className="border-default-200 border-b pb-4">
            <h3 className="mb-1 font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Emitido por
            </h3>
            <p className="font-medium text-lg">{data.doctor.name}</p>
            <p className="text-foreground/60 text-sm">{data.doctor.specialty}</p>
          </div>

          <div>
            <h3 className="mb-1 font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Fecha de emisión
            </h3>
            <p className="text-lg">{dayjs(data.issuedAt).format("DD [de] MMMM [de] YYYY")}</p>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-info/10 p-4">
          <p className="text-center text-info text-sm">
            Este certificado ha sido verificado digitalmente y es auténtico
          </p>
        </div>
      </div>
    </div>
  );
}
