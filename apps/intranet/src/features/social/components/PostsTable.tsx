import { Button, Chip, Tooltip } from "@heroui/react";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Eye, Send, XCircle } from "lucide-react";
import { useMemo } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { formatChile } from "@/lib/dates";
import { useApproveSocialPost, usePublishNow, useRejectSocialPost } from "../queries";
import { SOCIAL_NETWORK_LABELS, SOCIAL_PLACEMENT_LABELS, type SocialPost } from "../types";
import { PostStatusBadge } from "./StatusBadge";

interface PostsTableProps {
  readonly posts: SocialPost[];
  readonly isLoading?: boolean;
  readonly onOpenDetail: (post: SocialPost) => void;
}

function captionPreview(post: SocialPost): string {
  const text = post.title?.trim() || post.caption?.trim() || "(sin texto)";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function PostsTable({ posts, isLoading, onOpenDetail }: Readonly<PostsTableProps>) {
  const toast = useToast();
  const approveMutation = useApproveSocialPost();
  const rejectMutation = useRejectSocialPost();
  const publishMutation = usePublishNow();

  const handleApprove = async (post: SocialPost) => {
    const ok = await confirmAction({
      title: "Aprobar publicación",
      description: `Se aprobará "${captionPreview(post)}". Quedará lista para programar o publicar.`,
      confirmLabel: "Aprobar",
    });
    if (!ok) return;
    try {
      await approveMutation.mutateAsync(post.id);
      toast.success("Publicación aprobada");
    } catch (error) {
      toast.error(error, "No se pudo aprobar");
    }
  };

  const handleReject = async (post: SocialPost) => {
    const ok = await confirmAction({
      title: "Rechazar publicación",
      description: `Se rechazará "${captionPreview(post)}". Esta acción descarta el borrador.`,
      confirmLabel: "Rechazar",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await rejectMutation.mutateAsync({ id: post.id, reason: "Rechazado desde el panel" });
      toast.success("Publicación rechazada");
    } catch (error) {
      toast.error(error, "No se pudo rechazar");
    }
  };

  const handlePublishNow = async (post: SocialPost) => {
    const ok = await confirmAction({
      title: "Publicar ahora",
      description: `Se publicará "${captionPreview(post)}" inmediatamente en las cuentas configuradas.`,
      confirmLabel: "Publicar ahora",
    });
    if (!ok) return;
    try {
      await publishMutation.mutateAsync(post.id);
      toast.success("Publicación encolada");
    } catch (error) {
      toast.error(error, "No se pudo publicar");
    }
  };

  const columns = useMemo<ColumnDef<SocialPost>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Publicación",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[28rem]">
            <p className="truncate font-medium text-sm">{captionPreview(row.original)}</p>
            {row.original.caption && row.original.title ? (
              <p className="truncate text-default-400 text-xs">{row.original.caption}</p>
            ) : null}
          </div>
        ),
      },
      {
        id: "status",
        header: "Estado",
        cell: ({ row }) => <PostStatusBadge status={row.original.status} />,
      },
      {
        id: "targets",
        header: "Destinos",
        enableSorting: false,
        cell: ({ row }) => {
          const targets = row.original.targets ?? [];
          if (targets.length === 0) {
            return <span className="text-default-400 text-xs">—</span>;
          }
          return (
            <div className="flex max-w-[18rem] flex-wrap gap-1">
              {targets.map((t) => (
                <Chip key={t.id} color="default" size="sm" variant="soft">
                  {SOCIAL_NETWORK_LABELS[t.network]} · {SOCIAL_PLACEMENT_LABELS[t.placement]}
                </Chip>
              ))}
            </div>
          );
        },
      },
      {
        id: "scheduledAt",
        header: "Programado",
        cell: ({ row }) =>
          row.original.scheduledAt ? (
            <span className="text-sm">
              {formatChile(row.original.scheduledAt, "DD/MM/YYYY HH:mm")}
            </span>
          ) : (
            <span className="text-default-400 text-xs">—</span>
          ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const post = row.original;
          const canApprove = post.status === "DRAFT" || post.status === "PENDING_APPROVAL";
          const canReject = post.status === "DRAFT" || post.status === "PENDING_APPROVAL";
          const canPublish =
            post.status === "SCHEDULED" ||
            post.status === "PENDING_APPROVAL" ||
            post.status === "FAILED";
          return (
            <div className="flex items-center gap-1">
              <Tooltip>
                <Tooltip.Trigger>
                  <Button
                    aria-label="Ver detalle"
                    isIconOnly
                    size="sm"
                    variant="outline"
                    onPress={() => onOpenDetail(post)}
                  >
                    <Eye aria-hidden size={16} />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content>Ver detalle</Tooltip.Content>
              </Tooltip>
              {canApprove ? (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      aria-label="Aprobar"
                      isIconOnly
                      size="sm"
                      variant="outline"
                      onPress={() => void handleApprove(post)}
                    >
                      <CheckCircle2 aria-hidden size={16} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Aprobar</Tooltip.Content>
                </Tooltip>
              ) : null}
              {canReject ? (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      aria-label="Rechazar"
                      isIconOnly
                      size="sm"
                      variant="outline"
                      onPress={() => void handleReject(post)}
                    >
                      <XCircle aria-hidden size={16} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Rechazar</Tooltip.Content>
                </Tooltip>
              ) : null}
              {canPublish ? (
                <Tooltip>
                  <Tooltip.Trigger>
                    <Button
                      aria-label="Publicar ahora"
                      isIconOnly
                      size="sm"
                      variant="outline"
                      onPress={() => void handlePublishNow(post)}
                    >
                      <Send aria-hidden size={16} />
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Publicar ahora</Tooltip.Content>
                </Tooltip>
              ) : null}
            </div>
          );
        },
      },
    ],
    // handlers are stable closures over mutations/toast; re-create when deps change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onOpenDetail]
  );

  return (
    <DataTable
      columns={columns}
      data={posts}
      isLoading={isLoading}
      noDataMessage="No hay publicaciones en este estado."
    />
  );
}
