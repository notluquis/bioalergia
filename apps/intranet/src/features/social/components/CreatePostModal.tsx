import { Button, Checkbox, Form, Modal } from "@heroui/react";
import { useForm } from "@tanstack/react-form";
import { Save } from "lucide-react";
import { useEffect } from "react";

import {
  TanStackInputField,
  TanStackSelectField,
  TanStackTextAreaField,
} from "@/components/forms/TanStackFieldControls";
import { useToast } from "@/context/ToastContext";
import { useCreateSocialPost, useSocialAccounts } from "../queries";
import {
  PLACEMENTS_BY_NETWORK,
  SOCIAL_ASPECT_RATIO_LABELS,
  SOCIAL_MEDIA_TYPE_LABELS,
  SOCIAL_NETWORK_LABELS,
  SOCIAL_PLACEMENT_LABELS,
  type SocialAspectRatio,
  type SocialMediaType,
  type SocialNetwork,
  type SocialPlacement,
} from "../types";

interface CreatePostModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

interface CreateFormState {
  title: string;
  caption: string;
  hashtags: string;
  mediaType: SocialMediaType;
  aspectRatio: SocialAspectRatio;
  /** Set of `${accountId}:${network}:${placement}` keys selected as targets. */
  targets: string[];
}

const MEDIA_TYPE_OPTIONS = Object.entries(SOCIAL_MEDIA_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const ASPECT_RATIO_OPTIONS = Object.entries(SOCIAL_ASPECT_RATIO_LABELS).map(([value, label]) => ({
  value,
  label,
}));

interface TargetOption {
  key: string;
  accountId: number;
  network: SocialNetwork;
  placement: SocialPlacement;
  label: string;
}

export function CreatePostModal({ isOpen, onClose }: Readonly<CreatePostModalProps>) {
  const toast = useToast();
  const createMutation = useCreateSocialPost();
  const { data: accounts = [] } = useSocialAccounts();

  // Meta accounts cover IG (INSTAGRAM placements) + FB (FACEBOOK placements).
  // Build a flat list of selectable network+placement targets per account.
  const targetOptions: TargetOption[] = accounts
    .filter((a) => a.active)
    .flatMap((account) => {
      const networks: SocialNetwork[] = [];
      if (account.igUserId) networks.push("INSTAGRAM");
      if (account.fbPageId) networks.push("FACEBOOK");
      return networks.flatMap((network) =>
        PLACEMENTS_BY_NETWORK[network].map((placement) => ({
          key: `${account.id}:${network}:${placement}`,
          accountId: account.id,
          network,
          placement,
          label: `${account.displayName ?? `Cuenta #${account.id}`} · ${SOCIAL_NETWORK_LABELS[network]} ${SOCIAL_PLACEMENT_LABELS[placement]}`,
        }))
      );
    });

  const form = useForm({
    defaultValues: {
      title: "",
      caption: "",
      hashtags: "",
      mediaType: "IMAGE",
      aspectRatio: "RATIO_4_5",
      targets: [],
    } as CreateFormState,
    onSubmit: async ({ value }) => {
      const selected = targetOptions.filter((o) => value.targets.includes(o.key));
      if (selected.length === 0) {
        toast.error("Selecciona al menos un destino", "Falta destino");
        return;
      }
      const hashtags = value.hashtags
        .split(/[\s,]+/)
        .map((h) => h.trim().replace(/^#/, ""))
        .filter(Boolean);
      try {
        await createMutation.mutateAsync({
          mediaType: value.mediaType,
          aspectRatio: value.aspectRatio,
          ...(value.title.trim() ? { title: value.title.trim() } : {}),
          ...(value.caption.trim() ? { caption: value.caption.trim() } : {}),
          ...(hashtags.length > 0 ? { hashtags } : {}),
          targets: selected.map((o) => ({
            accountId: o.accountId,
            network: o.network,
            placement: o.placement,
          })),
        });
        toast.success("Borrador creado");
        form.reset();
        onClose();
      } catch (error) {
        toast.error(error, "No se pudo crear el borrador");
      }
    },
  });

  useEffect(() => {
    if (isOpen) form.reset();
  }, [isOpen, form]);

  const isPending = createMutation.isPending;

  const handleClose = () => {
    if (isPending) return;
    form.reset();
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>Nuevo borrador</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              <Form
                className="space-y-4 pb-2"
                onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
                validationBehavior="aria"
              >
                <form.Field name="title">
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="Título (interno)"
                      placeholder="Ej: Promo invierno"
                    />
                  )}
                </form.Field>

                <form.Field name="caption">
                  {(field) => (
                    <TanStackTextAreaField
                      field={field}
                      label="Texto / caption"
                      placeholder="Texto que acompaña la publicación"
                      rows={4}
                    />
                  )}
                </form.Field>

                <form.Field name="hashtags">
                  {(field) => (
                    <TanStackInputField
                      field={field}
                      label="Hashtags"
                      description="Separados por espacio o coma. El # es opcional."
                      placeholder="alergia inmunoterapia salud"
                    />
                  )}
                </form.Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <form.Field name="mediaType">
                    {(field) => (
                      <TanStackSelectField
                        field={field}
                        label="Tipo de media"
                        options={MEDIA_TYPE_OPTIONS}
                      />
                    )}
                  </form.Field>
                  <form.Field name="aspectRatio">
                    {(field) => (
                      <TanStackSelectField
                        field={field}
                        label="Proporción"
                        options={ASPECT_RATIO_OPTIONS}
                      />
                    )}
                  </form.Field>
                </div>

                <form.Field name="targets">
                  {(field) => (
                    <div className="space-y-2">
                      <p className="font-medium text-sm">Destinos</p>
                      {targetOptions.length === 0 ? (
                        <p className="text-default-400 text-xs">
                          No hay cuentas conectadas. Conecta una cuenta de Meta en la pestaña
                          Cuentas.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2 rounded-xl border border-divider p-3">
                          {targetOptions.map((opt) => {
                            const checked = field.state.value.includes(opt.key);
                            return (
                              <Checkbox
                                isSelected={checked}
                                key={opt.key}
                                onChange={(isSelected) => {
                                  const next = isSelected
                                    ? [...field.state.value, opt.key]
                                    : field.state.value.filter((k) => k !== opt.key);
                                  field.handleChange(() => next);
                                }}
                              >
                                <Checkbox.Content>
                                  <Checkbox.Control>
                                    <Checkbox.Indicator />
                                  </Checkbox.Control>
                                  {opt.label}
                                </Checkbox.Content>
                              </Checkbox>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </form.Field>

                <div className="flex justify-end gap-2 pt-2">
                  <Button isDisabled={isPending} variant="outline" onPress={handleClose}>
                    Cancelar
                  </Button>
                  <Button isPending={isPending} type="submit" variant="primary">
                    <Save size={16} /> Crear borrador
                  </Button>
                </div>
              </Form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
