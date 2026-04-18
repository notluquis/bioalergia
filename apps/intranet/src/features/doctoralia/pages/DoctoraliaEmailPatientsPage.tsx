import { Button, Surface } from "@heroui/react";
import { Input } from "@/components/ui/Input";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Search, X } from "lucide-react";
import React, { useCallback, useDeferredValue, useState } from "react";
import { fetchDoctoraliaEmailPatientHistory, fetchDoctoraliaEmailPatients } from "../api";
import { DoctoraliaCookieStorePanel } from "../components/DoctoraliaCookieStorePanel";
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
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-6 shadow-xl sm:rounded-l-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-default-900">{patient.patientName}</h2>
            {patient.patientPhone && (
              <p className="text-default-500 text-sm">{patient.patientPhone}</p>
            )}
            {patient.patientEmail && (
              <p className="text-default-500 text-sm">{patient.patientEmail}</p>
            )}
          </div>
          <Button isIconOnly size="sm" variant="ghost" onPress={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <hr className="border-default-100" />

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
                      {dayjs(n.appointmentDate).format("D MMM YYYY, HH:mm")}
                    </span>
                  )}
                </div>
                {n.appointmentService && (
                  <p className="mt-1 text-default-700 text-sm">{n.appointmentService}</p>
                )}
                {n.appointmentDoctor && (
                  <p className="text-default-500 text-xs">{n.appointmentDoctor}</p>
                )}
                {n.clinicAddress && <p className="text-default-400 text-xs">{n.clinicAddress}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const clearSearch = useCallback(() => setSearch(""), []);

  return (
    <section className="space-y-4">
      <DoctoraliaCookieStorePanel />

      <div className="max-w-xs">
        <Input
          placeholder="Buscar paciente…"
          value={search}
          onChange={handleSearchChange}
          startContent={<Search className="h-4 w-4 text-default-400" />}
          endContent={
            search ? (
              <button onClick={clearSearch} className="text-default-400 hover:text-default-600">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : undefined
          }
        />
      </div>

      <Surface variant="default" className="overflow-hidden rounded-2xl border border-default-100">
        {isLoading ? (
          <div className="py-12 text-center text-default-400 text-sm">Cargando…</div>
        ) : patients.length === 0 ? (
          <div className="py-12 text-center text-default-400 text-sm">
            {search ? "Sin resultados para la búsqueda." : "Sin pacientes registrados aún."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-default-100 bg-default-50">
                <th className="px-4 py-3 text-left font-medium text-default-500 text-xs uppercase tracking-wide">
                  Paciente
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-default-500 text-xs uppercase tracking-wide sm:table-cell">
                  Teléfono
                </th>
                <th className="px-4 py-3 text-center font-medium text-default-500 text-xs uppercase tracking-wide">
                  Citas
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-default-500 text-xs uppercase tracking-wide md:table-cell">
                  Última cita
                </th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient, i) => (
                <tr
                  key={`${patient.patientName}|||${patient.patientPhone ?? ""}`}
                  className={`cursor-pointer border-b border-default-50 transition-colors hover:bg-default-50 ${
                    i === patients.length - 1 ? "border-none" : ""
                  }`}
                  onClick={() => setSelectedPatient(patient)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-default-900">{patient.patientName}</div>
                    {patient.patientEmail && (
                      <div className="text-default-400 text-xs">{patient.patientEmail}</div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-default-600 sm:table-cell">
                    {patient.patientPhone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-default-700">
                    {patient.totalBookings}
                  </td>
                  <td className="hidden px-4 py-3 text-default-500 md:table-cell">
                    {patient.lastAppointmentDate
                      ? dayjs(patient.lastAppointmentDate).format("D MMM YYYY")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>

      {selectedPatient && (
        <PatientHistoryDrawer patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
      )}
    </section>
  );
}
