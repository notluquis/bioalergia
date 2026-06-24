import { Button, Description, Label, ListBox, Modal, SearchField, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import { fetchPatients } from "@/features/patients/api";

type Patient = Awaited<ReturnType<typeof fetchPatients>>[number];

/**
 * Patient picker — mirrors the shipments-page modal. Extracted so the
 * exam-reports wizard can reuse it without copy-pasting (and the next
 * feature that needs a patient picker can too). Same API as the
 * shipments inline copy: `onSelect(patient)` for a hit, `onCreateNew()`
 * to escalate to `CreatePatientModal` (the caller wires it up).
 */
export function PatientSelectModal({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (patient: Patient) => void;
  onCreateNew: () => void;
}) {
  const [search, setSearch] = useState("");

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients", search],
    queryFn: () => fetchPatients(search || undefined),
    staleTime: 1000 * 30,
  });

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>Seleccionar Paciente</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="gap-4">
              <SearchField
                aria-label="Buscar paciente"
                fullWidth
                onChange={setSearch}
                value={search}
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Buscar por nombre o RUT..." />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>

              <div className="max-h-64 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-default-600 text-sm">
                    <Spinner size="sm" />
                    Buscando...
                  </div>
                ) : patients.length === 0 ? (
                  <p className="py-4 text-center text-default-600 text-sm">Sin resultados</p>
                ) : (
                  <ListBox
                    aria-label="Pacientes"
                    onAction={(key) => {
                      const patient = patients.find((p) => String(p.id) === String(key));
                      if (patient) onSelect(patient);
                    }}
                    selectionMode="none"
                  >
                    {patients.map((p) => (
                      <ListBox.Item
                        id={String(p.id)}
                        key={p.id}
                        textValue={`${p.person.names} ${p.person.fatherName ?? ""}`}
                      >
                        <Label>
                          {p.person.names} {p.person.fatherName ?? ""}
                        </Label>
                        <Description className="font-mono">{p.person.rut ?? "Sin RUT"}</Description>
                      </ListBox.Item>
                    ))}
                  </ListBox>
                )}
              </div>

              <div className="border-default-100 border-t pt-3">
                <Button className="w-full gap-2" onPress={onCreateNew} size="sm" variant="outline">
                  <UserPlus size={15} />
                  Registrar nuevo paciente
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
