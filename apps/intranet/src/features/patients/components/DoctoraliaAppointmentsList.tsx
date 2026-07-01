import { formatChile } from "@/lib/dates";
import { Card, Chip, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { patientQueries } from "../queries";

// Doctoralia attendance codes (Docplanner): 1 = asistió, 2 = no-show.
function attendanceChip(attendance: number) {
  if (attendance === 1)
    return (
      <Chip size="sm" variant="soft" color="success">
        <Chip.Label>Asistió</Chip.Label>
      </Chip>
    );
  if (attendance === 2)
    return (
      <Chip size="sm" variant="soft" color="danger">
        <Chip.Label>No asistió</Chip.Label>
      </Chip>
    );
  return null;
}

export function DoctoraliaAppointmentsList({ patientId }: { patientId: number }) {
  const { data, isLoading } = useQuery(patientQueries.doctoraliaAppointments(patientId));
  const appts = data?.items ?? [];

  if (isLoading) {
    return (
      <Card className="border-none bg-background shadow-sm">
        <Card.Header className="gap-3">
          <Skeleton className="size-5 rounded-md" />
          <Skeleton className="h-5 w-40 rounded-md" />
        </Card.Header>
        <Card.Content className="space-y-2 pt-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-md" />
          ))}
        </Card.Content>
      </Card>
    );
  }

  if (appts.length === 0) {
    return (
      <Card className="border-none bg-background shadow-sm">
        <Card.Header className="items-center gap-3">
          <CalendarClock size={18} className="text-default-400" />
          <div>
            <Card.Title className="text-base">Citas Doctoralia</Card.Title>
            <Card.Description>No hay citas de Doctoralia vinculadas.</Card.Description>
          </div>
        </Card.Header>
      </Card>
    );
  }

  return (
    <Card className="border-none bg-background shadow-sm" data-phi-block>
      <Card.Header className="gap-3">
        <CalendarClock size={18} className="text-accent" />
        <div>
          <Card.Title className="text-base">Citas Doctoralia</Card.Title>
          <Card.Description>{appts.length} cita(s) vinculada(s)</Card.Description>
        </div>
      </Card.Header>
      <Card.Content className="space-y-2 pt-0">
        {appts.map((appt) => (
          <div key={appt.id} className="rounded-md border border-default-100 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{formatChile(appt.startAt, "DD/MM/YYYY HH:mm")}</span>
              {attendanceChip(appt.attendance)}
            </div>
            <p className="text-default-500 text-xs">{appt.serviceName}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {appt.insuranceName ? (
                <Chip size="sm" variant="soft">
                  <Chip.Label>{appt.insuranceName}</Chip.Label>
                </Chip>
              ) : null}
            </div>
            {appt.comments ? (
              <p className="mt-1 whitespace-pre-line text-default-600 text-xs">{appt.comments}</p>
            ) : null}
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}
