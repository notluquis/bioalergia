import { Skeleton, Switch } from "@heroui/react";
import { Mail, MailX } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { usePatientOptIn, useSetPatientOptIn } from "../queries";

/**
 * Per-patient email marketing consent toggle for the ficha. Self-contained:
 * fetches + mutates its own state via the email router, so it doesn't depend on
 * the patient-detail payload carrying the consent fields.
 */
export function PatientEmailOptInToggle({
  personId,
  email,
}: {
  personId: number;
  email?: string | null;
}) {
  const toast = useToast();
  const { data, isLoading } = usePatientOptIn(personId);
  const mutation = useSetPatientOptIn();

  const handleChange = async (optIn: boolean) => {
    try {
      await mutation.mutateAsync({ personId, optIn });
      toast.success(optIn ? "Paciente suscrito a novedades" : "Paciente dado de baja");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar consentimiento");
    }
  };

  if (isLoading) {
    return <Skeleton className="h-8 w-48 rounded-lg" />;
  }

  const optIn = data?.optIn ?? false;
  const noEmail = !email;

  return (
    <div className="flex flex-col gap-1">
      <Switch
        isSelected={optIn}
        isDisabled={mutation.isPending || noEmail}
        onChange={(v) => void handleChange(v)}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <span className="flex items-center gap-1.5 text-sm">
            {optIn ? <Mail size={14} /> : <MailX size={14} />}
            Correos de novedades
          </span>
        </Switch.Content>
      </Switch>
      {noEmail ? (
        <p className="text-xs text-warning-600">Sin email registrado — agrégalo para suscribir.</p>
      ) : data?.unsubscribedAt && !optIn ? (
        <p className="text-xs text-foreground-400">Se dio de baja por su cuenta.</p>
      ) : null}
    </div>
  );
}
