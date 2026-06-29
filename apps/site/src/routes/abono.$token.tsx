import { Alert, Button, Card, Chip, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { Key } from "@heroui/react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShopShell } from "@/components/ShopShell";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const Route = createFileRoute("/abono/$token")({
  component: AbonoPage,
  loader: async ({ params }) => {
    const res = await fetch(`/api/abono/${params.token}`);
    if (!res.ok) {
      if (res.status === 404) throw new Error("Abono no encontrado");
      if (res.status === 410) throw new Error("Link expirado");
      throw new Error("Error al cargar");
    }
    return res.json() as Promise<{
      id: string;
      patientName: string;
      appointmentDate: string;
      doctorName: string;
      serviceName: string;
      isFonasa: boolean;
      fullAmountClp: number;
      halfAmountClp: number;
      status: string;
      paidAmountClp: number | null;
      paidAt: string | null;
      pricing: {
        fonasaFullAmountClp: number;
        particularFullAmountClp: number;
      };
    }>;
  },
  errorComponent: ({ error }) => (
    <ShopShell>
      <main className="mx-auto max-w-xl px-4 py-12">
        <Alert status="danger">
          <Alert.Content>
            <Alert.Description>{error.message}</Alert.Description>
          </Alert.Content>
        </Alert>
      </main>
    </ShopShell>
  ),
});

function AbonoPage() {
  const data = Route.useLoaderData();
  // Our own return flag (`abono`) — NOT `status`, which collides with the
  // `status` param MercadoPago appends to the back_url.
  const search = Route.useSearch() as { abono?: string };
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // Returning from MP checkout, payment not yet registered → re-run the loader
  // every 4s until the webhook flips the token to APPROVED. Stops after ~2 min.
  useEffect(() => {
    if (search.abono !== "ok" || data.status === "APPROVED") return;
    let polls = 0;
    const id = setInterval(() => {
      if (++polls > 30) return clearInterval(id);
      void router.invalidate();
    }, 4000);
    return () => clearInterval(id);
  }, [search.abono, data.status, router]);

  // State for user selection
  const [insuranceType, setInsuranceType] = useState<"fonasa" | "particular">(
    data.isFonasa ? "fonasa" : "particular"
  );

  const currentFullAmount =
    insuranceType === "fonasa"
      ? data.pricing.fonasaFullAmountClp
      : data.pricing.particularFullAmountClp;
  const currentHalfAmount = Math.round(currentFullAmount / 2);

  const formatClp = (num: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(num);
  const formatDate = (dateStr: string) => {
    // 24h (Chile) → sin "a. m./p. m."; capitalizamos solo la inicial en JS
    // (el CSS `capitalize` ponía "De"/"A.m." en cada palabra).
    const s = new Intl.DateTimeFormat("es-CL", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(dateStr));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const handlePay = async (amount: "half" | "full") => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/abono/${data.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, insuranceType }),
      });
      const result = await res.json();
      if (result.init_point) {
        window.location.href = result.init_point;
      } else {
        alert("Error al iniciar el pago");
      }
    } catch (e) {
      alert("Error al iniciar el pago");
    } finally {
      setIsLoading(false);
    }
  };

  if (data.status === "APPROVED") {
    return (
      <ShopShell>
        <main className="mx-auto max-w-xl space-y-6 px-4 py-12">
          <header className="space-y-3">
            <h1 className="font-display text-[2rem] text-brand-green sm:text-[2.5rem]">
              ¡Abono Confirmado!
            </h1>
            <p className="text-muted text-lg">
              Hemos registrado tu pago exitosamente. Te contactaremos pronto vía WhatsApp desde
              nuestro número para confirmar los detalles.
            </p>
          </header>
        </main>
      </ShopShell>
    );
  }

  return (
    <ShopShell>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-12">
        <header className="space-y-3">
          <Eyebrow>Primera visita</Eyebrow>
          <h1 className="font-display text-[2rem] text-foreground sm:text-[2.5rem]">
            Confirma tu cita
          </h1>
          <p className="text-muted">
            Hola <strong>{data.patientName}</strong>, por favor realiza el abono para confirmar tu
            reserva.
          </p>
        </header>

        {search.abono === "ok" && (
          <Alert status="warning">
            <Alert.Content>
              <Alert.Description>
                Estamos confirmando el pago con Mercado Pago. Si ya pagaste, esta página se
                actualizará cuando el pago quede registrado.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
        {search.abono === "failed" && (
          <Alert status="danger">
            <Alert.Content>
              <Alert.Description>
                El pago no se completó. Puedes intentarlo de nuevo abajo.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}

        <Card className="rounded-2xl border-line bg-surface p-6" variant="default">
          <dl className="space-y-2 text-sm text-foreground">
            <div className="flex justify-between">
              <dt className="text-muted">Servicio</dt>
              <dd className="font-medium">{data.serviceName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Profesional</dt>
              <dd className="font-medium">{data.doctorName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Fecha y hora</dt>
              <dd className="font-medium">{formatDate(data.appointmentDate)}</dd>
            </div>
          </dl>
        </Card>

        <section className="space-y-4">
          <h2 className="font-display text-xl">¿Cuál es tu previsión?</h2>
          <ToggleButtonGroup
            fullWidth
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([insuranceType])}
            onSelectionChange={(keys: Set<Key>) => {
              const k = [...keys][0];
              if (k === "fonasa" || k === "particular") setInsuranceType(k);
            }}
          >
            <ToggleButton id="fonasa" className="h-auto flex-col py-3">
              <span className="font-medium">FONASA</span>
              <span className="text-sm">{formatClp(data.pricing.fonasaFullAmountClp)}</span>
            </ToggleButton>
            <ToggleButton id="particular" className="h-auto flex-col py-3">
              <ToggleButtonGroup.Separator />
              <span className="font-medium">Isapre / Particular</span>
              <span className="text-sm">{formatClp(data.pricing.particularFullAmountClp)}</span>
            </ToggleButton>
          </ToggleButtonGroup>
          <Alert status="warning" className="text-sm">
            <Alert.Content>
              <Alert.Description>
                <strong>Importante:</strong> Se verificará en línea si el paciente pertenece a
                FONASA o Isapre al momento de la atención.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Pago total — primero + destacado (recomendado) */}
          <Card
            className="rounded-2xl border-2 border-brand-green bg-brand-green/5 p-6 text-center shadow-sm"
            variant="default"
          >
            <div className="mb-3 flex justify-center">
              <Chip color="success" size="sm" variant="primary">
                Recomendado
              </Chip>
            </div>
            <h3 className="mb-2 font-display text-lg">Pagar 100%</h3>
            <p className="mb-4 font-bold text-3xl text-brand-green">{formatClp(currentFullAmount)}</p>
            <p className="mb-6 text-muted text-sm">
              Dejas la consulta completamente pagada. No te preocupas de nada el día de tu cita.
            </p>
            <Button
              className="w-full"
              variant="primary"
              onPress={() => handlePay("full")}
              isDisabled={isLoading}
            >
              {isLoading ? "Iniciando pago..." : "Pagar total"}
            </Button>
          </Card>

          {/* Abono parcial — segundo, menos prominente */}
          <Card className="rounded-2xl border-line bg-surface p-6 text-center" variant="default">
            <h3 className="mb-2 font-display text-lg">Abonar 50%</h3>
            <p className="mb-4 font-bold text-2xl">{formatClp(currentHalfAmount)}</p>
            <p className="mb-6 text-muted text-sm">
              Pagas el resto ({formatClp(currentFullAmount - currentHalfAmount)}) en la clínica el
              día de tu cita.
            </p>
            <Button
              className="w-full"
              variant="secondary"
              onPress={() => handlePay("half")}
              isDisabled={isLoading}
            >
              {isLoading ? "Iniciando pago..." : "Abonar 50%"}
            </Button>
          </Card>
        </div>
      </main>
    </ShopShell>
  );
}
