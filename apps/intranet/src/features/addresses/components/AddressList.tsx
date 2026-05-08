import { Button, Card, Chip, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/context/ToastContext";
import { deleteAddress, listAddresses, setPrimaryAddress } from "../api";
import type { AddressDraft } from "./AddressFormModal";
import { AddressFormModal } from "./AddressFormModal";

interface AddressListProps {
  personId: number;
}

export function AddressList({ personId }: Readonly<AddressListProps>) {
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<AddressDraft | undefined>(undefined);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses", personId],
    queryFn: () => listAddresses(personId),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (id: number) => setPrimaryAddress(id, personId),
    onError: (err) => toastError(err instanceof Error ? err.message : "No se pudo cambiar"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["addresses", personId] });
      success("Dirección principal actualizada");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAddress(id),
    onError: (err) => toastError(err instanceof Error ? err.message : "No se pudo eliminar"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["addresses", personId] });
      success("Dirección eliminada");
    },
  });

  const handleEdit = (draft: AddressDraft) => {
    setEditingDraft(draft);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditingDraft(undefined);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditingDraft(undefined);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-primary">
            <MapPin size={18} />
            Direcciones ({addresses.length})
          </h3>
          <Button onPress={handleNew} size="sm" variant="primary">
            <Plus size={14} />
            Nueva
          </Button>
        </div>

        {addresses.length === 0 ? (
          <p className="rounded-lg bg-default-50 px-4 py-3 text-default-500 text-sm">
            Sin direcciones registradas.
          </p>
        ) : (
          <div className="space-y-2">
            {addresses.map((addr) => (
              <Card key={addr.id} className="border border-default-100">
                <Card.Content className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{addr.label}</span>
                        {addr.isPrimary && (
                          <Chip color="accent" size="sm" variant="soft">
                            <Star size={12} className="mr-1" />
                            Principal
                          </Chip>
                        )}
                      </div>
                      <p className="text-default-700 text-sm">
                        {addr.street} {addr.number}
                        {addr.supplement ? `, ${addr.supplement}` : ""}
                      </p>
                      <p className="text-default-500 text-xs">
                        {addr.comuna}, {addr.region}
                        {addr.postalCode ? ` · CP ${addr.postalCode}` : ""}
                      </p>
                      {addr.reference && (
                        <p className="text-default-400 text-xs italic">{addr.reference}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!addr.isPrimary && (
                        <Button
                          aria-label="Marcar como principal"
                          isDisabled={setPrimaryMutation.isPending}
                          onPress={() => setPrimaryMutation.mutate(addr.id)}
                          size="sm"
                          variant="ghost"
                        >
                          <Star size={14} />
                        </Button>
                      )}
                      <Button
                        aria-label="Editar"
                        onPress={() =>
                          handleEdit({
                            id: addr.id,
                            label: addr.label,
                            street: addr.street,
                            number: addr.number,
                            supplement: addr.supplement,
                            reference: addr.reference,
                            postalCode: addr.postalCode,
                            regionCode: addr.regionCode,
                            coverageCode: addr.coverageCode,
                            isPrimary: addr.isPrimary,
                          })
                        }
                        size="sm"
                        variant="ghost"
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        aria-label="Eliminar"
                        isDisabled={deleteMutation.isPending}
                        onPress={() => {
                          if (confirm("¿Eliminar esta dirección?")) {
                            deleteMutation.mutate(addr.id);
                          }
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 size={14} className="text-danger" />
                      </Button>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddressFormModal
        draft={editingDraft}
        isOpen={modalOpen}
        onClose={handleClose}
        personId={personId}
      />
    </>
  );
}
