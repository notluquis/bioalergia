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

export const Route = createFileRoute("/verify/$id")({
  component: VerifyCertificatePage,
});

function VerifyCertificatePage() {
  const { id } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["verify-certificate", id],
    queryFn: async () => {
      const data = await apiClient.get<any>(`certificates/verify/${id}`, {
        responseSchema: VerifyCertificateSchema,
      });
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-foreground/70">Verificando certificado...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-danger/10">
        <div className="bg-background p-8 rounded-2xl shadow-xl max-w-md text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-3xl font-bold text-danger mb-2">Certificado Inválido</h1>
          <p className="text-foreground/70">
            {data?.error || "Este certificado no existe o ha sido revocado"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-success/10 p-4">
      <div className="bg-background p-8 rounded-2xl shadow-xl max-w-2xl w-full">
        <div className="text-center mb-6">
          <div className="text-6xl mb-2">✅</div>
          <h1 className="text-3xl font-bold text-success">Certificado Válido</h1>
        </div>

        <div className="space-y-6">
          <div className="border-b border-default-200 pb-4">
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
              Paciente
            </h3>
            <p className="text-xl font-medium">{data.patient.name}</p>
          </div>

          <div className="border-b border-default-200 pb-4">
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
              Diagnóstico
            </h3>
            <p className="text-lg">{data.diagnosis}</p>
          </div>

          {data.restDays && (
            <div className="border-b border-default-200 pb-4">
              <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
                Reposo Médico
              </h3>
              <p className="text-lg font-medium">{data.restDays} días</p>
              {data.restStartDate && data.restEndDate && (
                <p className="text-sm text-foreground/60 mt-1">
                  Desde {dayjs(data.restStartDate).format("DD/MM/YYYY")} hasta{" "}
                  {dayjs(data.restEndDate).format("DD/MM/YYYY")}
                </p>
              )}
            </div>
          )}

          <div className="border-b border-default-200 pb-4">
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
              Propósito
            </h3>
            <p className="text-lg capitalize">{data.purpose}</p>
          </div>

          <div className="border-b border-default-200 pb-4">
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
              Emitido por
            </h3>
            <p className="text-lg font-medium">{data.doctor.name}</p>
            <p className="text-sm text-foreground/60">{data.doctor.specialty}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground/70 uppercase tracking-wide mb-1">
              Fecha de emisión
            </h3>
            <p className="text-lg">{dayjs(data.issuedAt).format("DD [de] MMMM [de] YYYY")}</p>
          </div>
        </div>

        <div className="mt-8 p-4 bg-info/10 rounded-lg">
          <p className="text-sm text-info text-center">
            Este certificado ha sido verificado digitalmente y es auténtico
          </p>
        </div>
      </div>
    </div>
  );
}
