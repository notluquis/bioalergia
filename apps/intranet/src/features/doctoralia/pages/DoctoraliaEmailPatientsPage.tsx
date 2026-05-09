import { Button, Drawer, Label, SearchField, Table } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useDeferredValue, useState } from "react";
import { fetchDoctoraliaEmailPatientHistory, fetchDoctoraliaEmailPatients } from "../api";
import type { DoctoraliaEmailNotification, DoctoraliaEmailPatient } from "../types";

const EVENT_TYPE_LABEL: Record<DoctoraliaEmailNotification["eventType"], string> = {
  BOOKING: "Reserva",
  CANCELLATION: "Cancelación",
  MODIFICATION: "Modificación",
};

function PatientHistoryDrawer({
  patient,
  onClose,
}: {
  patient: DoctoraliaEmailPatient;
  onClose: () => void;
}) {
  const { data: notifications = [], isLoading } = useQuery({
    queryFn: () =>
      fetchDoctoraliaEmailPatientHistory({
        patientName: patient.patientName,
        patientPhone: patient.patientPhone,
      }),
    queryKey: [
      "doctoralia",
      "email-patients",
      "history",
      patient.patientName,
      patient.patientPhone,
    ],
  });

  return (
    <Drawer>
      <Drawer.Backdrop isOpen onOpenChange={(open) => !open && onClose()} variant="blur">
        <Drawer.Content placement="right" className="p-0 sm:p-3">
          <Drawer.Dialog className="flex h-full max-h-dvh flex-col overflow-hidden rounded-l-3xl border border-default-200 bg-background shadow-2xl sm:rounded-3xl">
            <Drawer.CloseTrigger />
            <Drawer.Header className="border-b border-default-100 pb-4">
              <Drawer.Heading>{patient.patientName}</Drawer.Heading>
              {patient.patientPhone && (
                <p className="text-default-500 text-sm">{patient.patientPhone}</p>
              )}
              {patient.patientEmail && (
                <p className="text-default-500 text-sm">{patient.patientEmail}</p>
              )}
            </Drawer.Header>

            <Drawer.Body className="pt-4">
              {isLoading ? (
                <div className="py-8 text-center text-default-400 text-sm">Cargando historial…</div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-default-400 text-sm">Sin registros.</div>
              ) : (
                <ul className="space-y-3">
                  {notifications.map((n) => (
                    <li key={n.id} className="rounded-xl border border-default-100 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={
                            n.eventType === "CANCELLATION"
                              ? "font-medium text-danger-600 text-sm"
                              : n.eventType === "MODIFICATION"
                                ? "font-medium text-warning-600 text-sm"
                                : "font-medium text-success-700 text-sm"
                          }
                        >
                          {EVENT_TYPE_LABEL[n.eventType]}
                        </span>
                        {n.appointmentDate && (
                          <span className="text-default-500 text-xs">
                            {dayjs(n.appointmentDate).tz().format("D MMM YYYY, HH:mm")}
                          </span>
                        )}
                      </div>
                      {n.appointmentService && (
                        <p className="mt-1 text-default-700 text-sm">{n.appointmentService}</p>
                      )}
                      {n.appointmentDoctor && (
                        <p className="text-default-500 text-xs">{n.appointmentDoctor}</p>
                      )}
                      {n.clinicAddress && (
                        <p className="text-default-400 text-xs">{n.clinicAddress}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

export function DoctoraliaEmailPatientsPage() {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedPatient, setSelectedPatient] = useState<DoctoraliaEmailPatient | null>(null);

  const { data: patients = [], isLoading } = useQuery({
    queryFn: () => fetchDoctoraliaEmailPatients({ search: deferredSearch || undefined }),
    queryKey: ["doctoralia", "email-patients", deferredSearch],
  });

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  return (
    <section className="space-y-4">
      <div className="max-w-xs">
        <SearchField onChange={handleSearchChange} value={search} variant="secondary">
          <Label className="sr-only">Buscar paciente</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar paciente..." />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      <div className="overflow-hidden rounded-2xl border border-default-100">
        {isLoading ? (
          <div className="py-12 text-center text-default-400 text-sm">Cargando…</div>
        ) : patients.length === 0 ? (
          <div className="py-12 text-center text-default-400 text-sm">
            {search ? "Sin resultados para la búsqueda." : "Sin pacientes registrados aún."}
          </div>
        ) : (
          <Table variant="secondary">
            <Table.Content aria-label="Pacientes con notificaciones Doctoralia por email">
              <Table.Header>
                <Table.Column isRowHeader>Paciente</Table.Column>
                <Table.Column className="hidden sm:table-cell">Teléfono</Table.Column>
                <Table.Column className="text-center">Citas</Table.Column>
                <Table.Column className="hidden md:table-cell">Última cita</Table.Column>
                <Table.Column className="text-right">Acciones</Table.Column>
              </Table.Header>
              <Table.Body>
                {patients.map((patient) => (
                  <Table.Row
                    id={`${patient.patientName}|||${patient.patientPhone ?? ""}`}
                    key={`${patient.patientName}|||${patient.patientPhone ?? ""}`}
                  >
                    <Table.Cell>
                      <div className="font-medium text-default-900">{patient.patientName}</div>
                      {patient.patientEmail && (
                        <div className="text-default-400 text-xs">{patient.patientEmail}</div>
                      )}
                    </Table.Cell>
                    <Table.Cell className="hidden sm:table-cell">
                      {patient.patientPhone ?? "—"}
                    </Table.Cell>
                    <Table.Cell className="text-center font-semibold text-default-700">
                      {patient.totalBookings}
                    </Table.Cell>
                    <Table.Cell className="hidden md:table-cell text-default-500">
                      {patient.lastAppointmentDate
                        ? dayjs(patient.lastAppointmentDate).format("D MMM YYYY")
                        : "—"}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button
                        onPress={() => setSelectedPatient(patient)}
                        size="sm"
                        variant="outline"
                      >
                        Ver historial
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table>
        )}
      </div>

      {selectedPatient && (
        <PatientHistoryDrawer patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
      )}
    </section>
  );
}
