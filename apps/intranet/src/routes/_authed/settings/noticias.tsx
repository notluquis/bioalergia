import { Button, Card, Chip } from "@heroui/react";
import type { ContentStatus } from "@/features/site-content/api";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { Megaphone, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { ArticleFormModal } from "@/features/site-content/components/ArticleFormModal";
import { listArticles, siteContentKeys } from "@/features/site-content/api";
import { chileDay } from "@/lib/dates";
import { PAGE_CONTAINER } from "@/lib/styles";

type ArticleSummary = Awaited<ReturnType<typeof listArticles>>[number];

const EMPTY: never[] = [];

const STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  ARCHIVED: "Archivada",
};

const STATUS_VARIANT: Record<ContentStatus, "primary" | "secondary"> = {
  DRAFT: "secondary",
  PUBLISHED: "primary",
  ARCHIVED: "secondary",
};

export const Route = createFileRoute("/_authed/settings/noticias")({
  staticData: {
    nav: {
      iconKey: "Megaphone",
      label: "Noticias (sitio)",
      order: 85,
      section: "Sistema",
    },
    permission: { action: "update", subject: "Article" },
    title: "Configuración — Noticias del sitio",
  },
  beforeLoad: requirePermission("update", "Article"),
  component: NoticiasSettingsPage,
});

function NoticiasSettingsPage() {
  const articlesQuery = useQuery({
    queryKey: siteContentKeys.articles(),
    queryFn: listArticles,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>(undefined);

  const articles = articlesQuery.data ?? EMPTY;

  const openNew = () => {
    setEditingId(undefined);
    setModalOpen(true);
  };
  const openEdit = (a: ArticleSummary) => {
    setEditingId(a.id);
    setModalOpen(true);
  };

  const columns = useMemo<ColumnDef<ArticleSummary>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Título",
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      { accessorKey: "category", header: "Categoría", cell: ({ row }) => row.original.category },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => (
          <Chip variant={STATUS_VARIANT[row.original.status]} size="sm">
            {STATUS_LABEL[row.original.status]}
          </Chip>
        ),
      },
      {
        accessorKey: "published_at",
        header: "Publicada",
        cell: ({ row }) => (row.original.published_at ? chileDay(row.original.published_at) : "—"),
      },
      {
        accessorKey: "reading_minutes",
        header: "Min. lectura",
        cell: ({ row }) => `${row.original.reading_minutes} min`,
      },
    ],
    []
  );

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-xl">
            <Megaphone size={22} /> Noticias del sitio
          </h1>
          <p className="text-default-500 text-sm">
            Artículos del blog público. Crea, edita y publica noticias del sitio.
          </p>
        </div>
        <Button className="gap-2" onPress={openNew}>
          <Plus size={18} /> Nueva noticia
        </Button>
      </div>

      <Card className="space-y-4 p-4">
        <DataTable
          columns={columns}
          data={articles}
          isLoading={articlesQuery.isLoading}
          enableToolbar={false}
          enableVirtualization={false}
          noDataMessage="Aún no hay noticias."
          onRowClick={(a) => openEdit(a)}
        />
      </Card>

      <ArticleFormModal isOpen={modalOpen} onOpenChange={setModalOpen} articleId={editingId} />
    </div>
  );
}
