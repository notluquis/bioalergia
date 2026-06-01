import { Button, Input, Label, Modal, TextArea, TextField } from "@heroui/react";
import type { CompanyDto } from "@finanzas/orpc-contracts/quotes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { createCompany, quotesKeys, updateCompany } from "@/features/quotes/api";
import { toast } from "@/lib/toast-interceptor";

type ContactDraft = { name: string; role: string; email: string; phone: string };
type Draft = {
  razonSocial: string;
  rut: string;
  giro: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  email: string;
  phone: string;
  condicionPago: string;
  notes: string;
  contacts: ContactDraft[];
};

function draftFrom(company?: CompanyDto): Draft {
  return {
    razonSocial: company?.razonSocial ?? "",
    rut: company?.rut ?? "",
    giro: company?.giro ?? "",
    direccion: company?.direccion ?? "",
    comuna: company?.comuna ?? "",
    ciudad: company?.ciudad ?? "",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    condicionPago: company?.condicionPago ?? "",
    notes: company?.notes ?? "",
    contacts:
      company?.contacts.map((c) => ({
        name: c.name,
        role: c.role ?? "",
        email: c.email ?? "",
        phone: c.phone ?? "",
      })) ?? [],
  };
}

type CompanyFormModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  company?: CompanyDto;
  onSaved?: (company: CompanyDto) => void;
};

export function CompanyFormModal({
  isOpen,
  onOpenChange,
  company,
  onSaved,
}: CompanyFormModalProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(company));
  const [loadedFor, setLoadedFor] = useState<number | null>(company?.id ?? null);

  // Re-hidratar el draft cuando cambia la empresa objetivo o se reabre limpio.
  const targetId = company?.id ?? null;
  if (isOpen && loadedFor !== targetId) {
    setDraft(draftFrom(company));
    setLoadedFor(targetId);
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: () => {
      const contacts = draft.contacts
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          role: c.role.trim() || null,
          email: c.email.trim() || null,
          phone: c.phone.trim() || null,
        }));
      const payload = {
        razonSocial: draft.razonSocial.trim(),
        rut: draft.rut.trim() || null,
        giro: draft.giro.trim() || null,
        direccion: draft.direccion.trim() || null,
        comuna: draft.comuna.trim() || null,
        ciudad: draft.ciudad.trim() || null,
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        condicionPago: draft.condicionPago.trim() || null,
        notes: draft.notes.trim() || null,
        isActive: true,
        contacts,
      };
      return company ? updateCompany({ id: company.id, ...payload }) : createCompany(payload);
    },
    onSuccess: (saved) => {
      toast.success(company ? "Empresa actualizada" : "Empresa creada");
      void queryClient.invalidateQueries({ queryKey: quotesKeys.companies() });
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label={company ? "Editar empresa" : "Nueva empresa"}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{company ? "Editar empresa" : "Nueva empresa"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                className="sm:col-span-2"
                value={draft.razonSocial}
                onChange={(v) => set("razonSocial", v)}
                isRequired
              >
                <Label>Razón social</Label>
                <Input placeholder="Centro de diagnóstico CDs" />
              </TextField>
              <TextField value={draft.rut} onChange={(v) => set("rut", v)}>
                <Label>RUT</Label>
                <Input placeholder="76.939.006-5" />
              </TextField>
              <TextField value={draft.giro} onChange={(v) => set("giro", v)}>
                <Label>Giro</Label>
                <Input placeholder="Servicios médicos" />
              </TextField>
              <TextField value={draft.direccion} onChange={(v) => set("direccion", v)}>
                <Label>Dirección</Label>
                <Input placeholder="San Martín 940" />
              </TextField>
              <TextField value={draft.comuna} onChange={(v) => set("comuna", v)}>
                <Label>Comuna</Label>
                <Input placeholder="Concepción" />
              </TextField>
              <TextField value={draft.ciudad} onChange={(v) => set("ciudad", v)}>
                <Label>Ciudad</Label>
                <Input placeholder="Concepción" />
              </TextField>
              <TextField value={draft.condicionPago} onChange={(v) => set("condicionPago", v)}>
                <Label>Condición de pago</Label>
                <Input placeholder="CRÉDITO 7 DÍAS" />
              </TextField>
              <TextField value={draft.email} onChange={(v) => set("email", v)}>
                <Label>Email</Label>
                <Input type="email" placeholder="contacto@empresa.cl" />
              </TextField>
              <TextField value={draft.phone} onChange={(v) => set("phone", v)}>
                <Label>Teléfono</Label>
                <Input placeholder="+56 9 5406 9116" />
              </TextField>
              <TextField
                className="sm:col-span-2"
                value={draft.notes}
                onChange={(v) => set("notes", v)}
              >
                <Label>Notas</Label>
                <TextArea rows={2} placeholder="Observaciones internas…" />
              </TextField>
            </div>

            {/* Contactos / solicitantes */}
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Contactos / solicitantes</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      contacts: [...d.contacts, { name: "", role: "", email: "", phone: "" }],
                    }))
                  }
                >
                  <Plus size={16} /> Agregar
                </Button>
              </div>
              {draft.contacts.map((c, idx) => (
                <div key={idx} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-12 sm:col-span-4">
                    <TextField
                      value={c.name}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          contacts: d.contacts.map((x, i) => (i === idx ? { ...x, name: v } : x)),
                        }))
                      }
                    >
                      <Label>Nombre</Label>
                      <Input placeholder="Claudia Vergara" />
                    </TextField>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <TextField
                      value={c.role}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          contacts: d.contacts.map((x, i) => (i === idx ? { ...x, role: v } : x)),
                        }))
                      }
                    >
                      <Label>Cargo</Label>
                      <Input placeholder="Solicitante" />
                    </TextField>
                  </div>
                  <div className="col-span-6 sm:col-span-4">
                    <TextField
                      value={c.email}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          contacts: d.contacts.map((x, i) => (i === idx ? { ...x, email: v } : x)),
                        }))
                      }
                    >
                      <Label>Email</Label>
                      <Input type="email" placeholder="correo@empresa.cl" />
                    </TextField>
                  </div>
                  <div className="col-span-12 flex justify-end sm:col-span-1">
                    <Button
                      variant="outline"
                      size="sm"
                      isIconOnly
                      className="text-danger"
                      onPress={() =>
                        setDraft((d) => ({
                          ...d,
                          contacts: d.contacts.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancelar
            </Button>
            <Button
              isPending={saveMutation.isPending}
              isDisabled={!draft.razonSocial.trim()}
              onPress={() => saveMutation.mutate()}
            >
              {company ? "Guardar" : "Crear empresa"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
