import { Button, Tabs } from "@heroui/react";
import { CalendarDays, FileEdit, Megaphone, Plus, Send, Users } from "lucide-react";
import { useCallback, useState } from "react";

import { Page } from "@/components/layouts/Page";
import { PageHeader } from "@/components/layouts/PageHeader";
import { PageState } from "@/components/ui/PageState";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";
import { AccountsPanel } from "../components/AccountsPanel";
import { ContentCalendar } from "../components/ContentCalendar";
import { CreatePostModal } from "../components/CreatePostModal";
import { PostDetailModal } from "../components/PostDetailModal";
import { PostsTable } from "../components/PostsTable";
import { useSocialPosts } from "../queries";
import { type SocialPost, type SocialTab, socialTabKey } from "../types";

interface SocialPageProps {
  readonly tab: SocialTab;
  readonly onTabChange: (tab: SocialTab) => void;
}

export function SocialPage({ tab, onTabChange }: Readonly<SocialPageProps>) {
  const { isTabMounted, markTabAsMounted } = useLazyTabs<SocialTab>(tab);
  const { isOpen: createOpen, open: openCreate, close: closeCreate } = useDisclosure();
  const [detailPostId, setDetailPostId] = useState<null | number>(null);

  const handleTabChange = useCallback(
    (key: unknown) => {
      const parsed = socialTabKey.safeParse(key);
      if (!parsed.success) return;
      markTabAsMounted(parsed.data);
      onTabChange(parsed.data);
    },
    [markTabAsMounted, onTabChange]
  );

  const openDetail = useCallback((post: SocialPost) => {
    setDetailPostId(post.id);
  }, []);

  return (
    <Page>
      <PageHeader
        title="Redes sociales"
        description="Revisa, aprueba y programa las publicaciones para Instagram, Facebook y TikTok."
        actions={
          <Button variant="primary" onPress={openCreate}>
            <Plus size={18} /> Nuevo borrador
          </Button>
        }
      />

      <Tabs aria-label="Redes sociales" selectedKey={tab} onSelectionChange={handleTabChange}>
        <Tabs.ListContainer>
          <Tabs.List
            aria-label="Secciones"
            className="rounded-2xl border border-default-200/60 bg-background/70 p-1"
          >
            <Tabs.Tab id="calendario">
              <CalendarDays size={14} /> Calendario
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="pendientes">
              <FileEdit size={14} /> Borradores / Pendientes
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="publicados">
              <Send size={14} /> Publicados
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="cuentas">
              <Users size={14} /> Cuentas
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel className="pt-4" id="calendario">
          {isTabMounted("calendario") ? <CalendarTab onOpenDetail={openDetail} /> : null}
        </Tabs.Panel>
        <Tabs.Panel className="pt-4" id="pendientes">
          {isTabMounted("pendientes") ? <PendingTab onOpenDetail={openDetail} /> : null}
        </Tabs.Panel>
        <Tabs.Panel className="pt-4" id="publicados">
          {isTabMounted("publicados") ? <PublishedTab onOpenDetail={openDetail} /> : null}
        </Tabs.Panel>
        <Tabs.Panel className="pt-4" id="cuentas">
          {isTabMounted("cuentas") ? <AccountsPanel /> : null}
        </Tabs.Panel>
      </Tabs>

      <CreatePostModal isOpen={createOpen} onClose={closeCreate} />
      <PostDetailModal
        isOpen={detailPostId !== null}
        onClose={() => setDetailPostId(null)}
        postId={detailPostId}
      />
    </Page>
  );
}

function CalendarTab({ onOpenDetail }: Readonly<{ onOpenDetail: (post: SocialPost) => void }>) {
  const postsQuery = useSocialPosts();
  return (
    <PageState
      query={postsQuery}
      loadingLabel="Cargando publicaciones"
      isEmpty={() => false}
      emptyIcon={<Megaphone size={40} />}
    >
      {(posts) => {
        const scheduled = posts.filter((p) => p.scheduledAt);
        return (
          <div className="space-y-4">
            <ContentCalendar posts={scheduled} />
            {scheduled.length === 0 ? (
              <p className="text-center text-default-400 text-sm">
                No hay publicaciones programadas todavía.
              </p>
            ) : null}
            <UpcomingList posts={scheduled} onOpenDetail={onOpenDetail} />
          </div>
        );
      }}
    </PageState>
  );
}

function UpcomingList({
  posts,
  onOpenDetail,
}: Readonly<{ posts: SocialPost[]; onOpenDetail: (post: SocialPost) => void }>) {
  if (posts.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-foreground text-sm">Programadas</h3>
      <PostsTable posts={posts} onOpenDetail={onOpenDetail} />
    </div>
  );
}

function PendingTab({ onOpenDetail }: Readonly<{ onOpenDetail: (post: SocialPost) => void }>) {
  const postsQuery = useSocialPosts();
  return (
    <PageState
      query={postsQuery}
      loadingLabel="Cargando borradores"
      isEmpty={(posts) =>
        posts.filter(
          (p) =>
            p.status === "DRAFT" ||
            p.status === "PENDING_APPROVAL" ||
            p.status === "SCHEDULED" ||
            p.status === "FAILED"
        ).length === 0
      }
      emptyIcon={<Megaphone size={40} />}
      emptyTitle="Sin borradores pendientes"
      emptyDescription="Genera borradores con el comando de Claude Code o crea uno manualmente."
    >
      {(posts) => (
        <PostsTable
          posts={posts.filter(
            (p) =>
              p.status === "DRAFT" ||
              p.status === "PENDING_APPROVAL" ||
              p.status === "SCHEDULED" ||
              p.status === "FAILED"
          )}
          onOpenDetail={onOpenDetail}
        />
      )}
    </PageState>
  );
}

function PublishedTab({ onOpenDetail }: Readonly<{ onOpenDetail: (post: SocialPost) => void }>) {
  const postsQuery = useSocialPosts("PUBLISHED");
  return (
    <PageState
      query={postsQuery}
      loadingLabel="Cargando publicadas"
      isEmpty={(posts) => posts.length === 0}
      emptyIcon={<Megaphone size={40} />}
      emptyTitle="Aún no hay publicaciones publicadas"
    >
      {(posts) => <PostsTable posts={posts} onOpenDetail={onOpenDetail} />}
    </PageState>
  );
}
