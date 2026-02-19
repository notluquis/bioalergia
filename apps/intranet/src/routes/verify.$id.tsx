import { Description, Skeleton } from "@heroui/react";
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
        <div className="w-full max-w-2xl space-y-4 rounded-2xl bg-background p-8 shadow-xl">
          <Skeleton className="mx-auto h-10 w-56 rounded-lg" />
          <Skeleton className="h-6 w-2/3 rounded-md" />
          <Skeleton className="h-6 w-3/4 rounded-md" />
          <Skeleton className="h-6 w-1/2 rounded-md" />
          <Description className="text-foreground/70 text-sm">
            Verificando certificado...
          </Description>
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
          <span className="mb-2 block font-bold text-3xl text-danger">Certificado Inválido</span>
          <Description className="text-foreground/70">{invalidMessage}</Description>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-success/10 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-background p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-6xl">✅</div>
          <span className="block font-bold text-3xl text-success">Certificado Válido</span>
        </div>

        <div className="space-y-6">
          <div className="border-default-200 border-b pb-4">
            <span className="mb-1 block font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Paciente
            </span>
            <span className="font-medium text-xl">{data.patient.name}</span>
          </div>

          <div className="border-default-200 border-b pb-4">
            <span className="mb-1 block font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Diagnóstico
            </span>
            <span className="text-lg">{data.diagnosis}</span>
          </div>

          {data.restDays && (
            <div className="border-default-200 border-b pb-4">
              <span className="mb-1 block font-semibold text-foreground/70 text-sm uppercase tracking-wide">
                Reposo Médico
              </span>
              <span className="font-medium text-lg">{data.restDays} días</span>
              {data.restStartDate && data.restEndDate && (
                <Description className="mt-1 text-foreground/60 text-sm">
                  Desde {dayjs(data.restStartDate).format("DD/MM/YYYY")} hasta{" "}
                  {dayjs(data.restEndDate).format("DD/MM/YYYY")}
                </Description>
              )}
            </div>
          )}

          <div className="border-default-200 border-b pb-4">
            <span className="mb-1 block font-semibold text-foreground/70 text-sm uppercase tracking-wide">
              Propósito
            </span>
            <span className="text-lg capitalize">{data.purpose}</span>
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
            <span className="text-lg">{dayjs(data.issuedAt).format("DD [de] MMMM [de] YYYY")}</span>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-info/10 p-4">
          <Description className="text-center text-info text-sm">
            Este certificado ha sido verificado digitalmente y es auténtico
          </Description>
        </div>
      </div>
    </div>
  );
}
