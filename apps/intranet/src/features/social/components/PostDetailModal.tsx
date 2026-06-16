import { Button, Chip, Modal } from "@heroui/react";
import { CalendarClock, CheckCircle2, ExternalLink, Send, XCircle } from "lucide-react";

import { confirmAction } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { formatChile } from "@/lib/dates";
import {
  useApproveSocialPost,
  usePublishNow,
  useRejectSocialPost,
  useScheduleSocialPost,
  useSocialPost,
} from "../queries";
import {
  SOCIAL_ASPECT_RATIO_LABELS,
  SOCIAL_MEDIA_TYPE_LABELS,
  SOCIAL_NETWORK_LABELS,
  SOCIAL_PLACEMENT_LABELS,
  type SocialPost,
} from "../types";
import { PostStatusBadge, TargetStatusBadge } from "./StatusBadge";

interface PostDetailModalProps {
  readonly postId: null | number;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function PostDetailModal({ postId, isOpen, onClose }: Readonly<PostDetailModalProps>) {
  const toast = useToast();
  const { data: post, isLoading } = useSocialPost(isOpen ? (postId ?? undefined) : undefined);

  const approveMutation = useApproveSocialPost();
  const rejectMutation = useRejectSocialPost();
  const scheduleMutation = useScheduleSocialPost();
  const publishMutation = usePublishNow();

  const isPending =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    scheduleMutation.isPending ||
    publishMutation.isPending;

  const handleApprove = async (p: SocialPost) => {
    try {
      await approveMutation.mutateAsync(p.id);
      toast.success("Publicación aprobada");
    } catch (error) {
      toast.error(error, "No se pudo aprobar");
    }
  };

  const handleReject = async (p: SocialPost) => {
    const ok = await confirmAction({
      title: "Rechazar publicación",
      description: "Se descartará este borrador. ¿Continuar?",
      confirmLabel: "Rechazar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await rejectMutation.mutateAsync({ id: p.id, reason: "Rechazado desde el detalle" });
      toast.success("Publicación rechazada");
      onClose();
    } catch (error) {
      toast.error(error, "No se pudo rechazar");
    }
  };

  const handleSchedule = async (p: SocialPost) => {
    // Schedule at the post's existing scheduledAt; if none, schedule for +1h.
    const when = p.scheduledAt ? new Date(p.scheduledAt) : new Date(Date.now() + 60 * 60 * 1000);
    const ok = await confirmAction({
      title: "Programar publicación",
      description: `Se programará para ${formatChile(when, "DD/MM/YYYY HH:mm")}.`,
      confirmLabel: "Programar",
    });
    if (!ok) return;
    try {
      await scheduleMutation.mutateAsync({ id: p.id, scheduledAt: when.toISOString() });
      toast.success("Publicación programada");
    } catch (error) {
      toast.error(error, "No se pudo programar");
    }
  };

  const handlePublishNow = async (p: SocialPost) => {
    const ok = await confirmAction({
      title: "Publicar ahora",
      description: "Se publicará inmediatamente en las cuentas configuradas.",
      confirmLabel: "Publicar ahora",
    });
    if (!ok) return;
    try {
      await publishMutation.mutateAsync(p.id);
      toast.success("Publicación encolada");
    } catch (error) {
      toast.error(error, "No se pudo publicar");
    }
  };

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
          <Modal.Dialog className="relative w-full max-w-3xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>Detalle de publicación</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
              {isLoading || !post ? (
                <p className="py-8 text-center text-default-400 text-sm">Cargando…</p>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <PostStatusBadge status={post.status} />
                    <Chip color="default" size="sm" variant="soft">
                      {SOCIAL_MEDIA_TYPE_LABELS[post.mediaType]}
                    </Chip>
                    <Chip color="default" size="sm" variant="soft">
                      {SOCIAL_ASPECT_RATIO_LABELS[post.aspectRatio]}
                    </Chip>
                  </div>

                  {post.media.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {post.media.map((m) =>
                        m.type === "image" ? (
                          <img
                            key={m.key}
                            alt={post.title ?? "Vista previa de la publicación"}
                            className="aspect-square w-full rounded-xl object-cover ring-1 ring-default-200"
                            src={m.url}
                          />
                        ) : (
                          <video
                            key={m.key}
                            aria-label={post.title ?? "Vista previa del video de la publicación"}
                            className="aspect-square w-full rounded-xl object-cover ring-1 ring-default-200"
                            controls
                            src={m.url}
                          >
                            <track kind="captions" />
                          </video>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-default-200 border-dashed p-4 text-center text-default-400 text-sm">
                      Sin media renderizada todavía.
                    </p>
                  )}

                  {post.title ? (
                    <div>
                      <p className="text-default-500 text-xs">Título</p>
                      <p className="font-medium text-sm">{post.title}</p>
                    </div>
                  ) : null}

                  {post.caption ? (
                    <div>
                      <p className="text-default-500 text-xs">Texto</p>
                      <p className="whitespace-pre-wrap text-sm">{post.caption}</p>
                    </div>
                  ) : null}

                  {post.hashtags.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {post.hashtags.map((h) => (
                        <Chip key={h} color="accent" size="sm" variant="soft">
                          #{h.replace(/^#/, "")}
                        </Chip>
                      ))}
                    </div>
                  ) : null}

                  {post.rejectedReason ? (
                    <div className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-danger text-sm">
                      Rechazado: {post.rejectedReason}
                    </div>
                  ) : null}

                  <div>
                    <p className="mb-2 text-default-500 text-xs">Estado por destino</p>
                    {(post.targets ?? []).length === 0 ? (
                      <p className="text-default-400 text-sm">Sin destinos configurados.</p>
                    ) : (
                      <ul className="divide-y divide-divider rounded-xl border border-divider">
                        {(post.targets ?? []).map((t) => (
                          <li
                            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                            key={t.id}
                          >
                            <span className="text-sm">
                              {SOCIAL_NETWORK_LABELS[t.network]} ·{" "}
                              {SOCIAL_PLACEMENT_LABELS[t.placement]}
                            </span>
                            <div className="flex items-center gap-2">
                              {t.permalink ? (
                                <a
                                  className="inline-flex items-center gap-1 text-primary text-xs underline"
                                  href={t.permalink}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  Ver <ExternalLink aria-hidden size={12} />
                                </a>
                              ) : null}
                              {t.errorMessage ? (
                                <span className="text-danger text-xs">{t.errorMessage}</span>
                              ) : null}
                              <TargetStatusBadge status={t.status} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    {(post.status === "DRAFT" || post.status === "PENDING_APPROVAL") && (
                      <>
                        <Button
                          isDisabled={isPending}
                          variant="outline"
                          onPress={() => void handleReject(post)}
                        >
                          <XCircle aria-hidden size={16} /> Rechazar
                        </Button>
                        <Button
                          isDisabled={isPending}
                          variant="primary"
                          onPress={() => void handleApprove(post)}
                        >
                          <CheckCircle2 aria-hidden size={16} /> Aprobar
                        </Button>
                      </>
                    )}
                    {(post.status === "PENDING_APPROVAL" ||
                      post.status === "SCHEDULED" ||
                      post.status === "FAILED") && (
                      <Button
                        isDisabled={isPending}
                        variant="outline"
                        onPress={() => void handleSchedule(post)}
                      >
                        <CalendarClock aria-hidden size={16} /> Programar
                      </Button>
                    )}
                    {(post.status === "PENDING_APPROVAL" ||
                      post.status === "SCHEDULED" ||
                      post.status === "FAILED") && (
                      <Button
                        isDisabled={isPending}
                        variant="primary"
                        onPress={() => void handlePublishNow(post)}
                      >
                        <Send aria-hidden size={16} /> Publicar ahora
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
