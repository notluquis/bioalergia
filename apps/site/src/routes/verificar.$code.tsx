import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, ShieldX } from "lucide-react";
import { z } from "zod";

import { verificationClient } from "@/lib/orpc-client";

// Search param opcional `h`: hash SHA-256 del PDF para el badge de integridad.
const VerificarSearchSchema = z.object({ h: z.string().optional() });

export const Route = createFileRoute("/verificar/$code")({
  component: VerificarDocumentPage,
  validateSearch: (search) => VerificarSearchSchema.parse(search),
});

function formatDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-default-200 bg-default-50 px-4 py-3">
      <span className="block font-semibold text-[11px] text-default-500 uppercase tracking-wide">
        {label}
      </span>
      <span className="mt-0.5 block font-medium text-foreground text-base">{value}</span>
      {hint ? <span className="mt-0.5 block text-default-400 text-xs">{hint}</span> : null}
    </div>
  );
}

function VerificarDocumentPage() {
  const { code } = Route.useParams();
  const { h } = Route.useSearch();

  const { data, isLoading } = useQuery({
    queryKey: ["verificar", code, h ?? null],
    queryFn: () => verificationClient.verify({ code, h }),
  });

  if (isLoading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-3">
          <div className="mx-auto rounded-full bg-default-200 size-12" />
          <div className="mx-auto h-6 w-48 rounded bg-default-200" />
          <div className="h-16 rounded-xl bg-default-100" />
          <div className="h-16 rounded-xl bg-default-100" />
        </div>
        <p className="mt-4 text-center text-default-500 text-sm">Verificando documento…</p>
      </Shell>
    );
  }

  if (!data?.valid) {
    return (
      <Shell>
        <div className="text-center">
          <ShieldX className="mx-auto mb-3 size-14 text-danger" />
          <h1 className="font-bold text-2xl text-danger">Documento inválido</h1>
          <p className="mt-2 text-default-500 text-sm">
            Este documento no existe, fue anulado o el código no es correcto.
          </p>
          <p className="mt-1 text-default-400 text-xs">Código consultado: {code}</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-5 text-center">
        <BadgeCheck className="mx-auto mb-2 size-14 text-secondary" />
        <h1 className="font-bold text-2xl text-secondary">Documento auténtico</h1>
        <p className="mt-1 text-default-500 text-sm">{data.documentLabel}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Documento" value={data.documentLabel} />
        {data.prescriptionType ? <Field label="Tipo" value={data.prescriptionType} /> : null}
        <Field
          label="Paciente"
          value={data.patientInitials}
          hint={
            data.patientRutMasked
              ? `RUT ${data.patientRutMasked} · por privacidad solo se muestran iniciales`
              : "Por privacidad solo se muestran iniciales"
          }
        />
        <Field label="Fecha de emisión" value={formatDate(data.issuedAt)} />
        <div className="sm:col-span-2">
          <Field
            label="Emitido por"
            value={data.doctor.name}
            hint={[data.doctor.specialty, data.doctor.license ? `Reg. SIS N° ${data.doctor.license}` : null]
              .filter(Boolean)
              .join(" · ")}
          />
        </div>
        {data.folio ? (
          <div className="sm:col-span-2">
            <Field label="Folio" value={data.folio} />
          </div>
        ) : null}
      </div>

      {data.pdfIntact !== undefined ? (
        <div
          className={`mt-4 rounded-xl p-3 text-sm ${data.pdfIntact ? "bg-secondary/10 text-secondary" : "bg-warning/10 text-warning"}`}
        >
          {data.pdfIntact
            ? "✓ El archivo PDF coincide con el original (no fue alterado)."
            : "⚠ El archivo PDF no coincide con el original registrado."}
        </div>
      ) : null}

      <p className="mt-6 text-center text-default-400 text-xs">
        Verificación oficial de documentos médicos · Bioalergia
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-default-100 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-background p-6 shadow-xl sm:p-8">{children}</div>
    </div>
  );
}
