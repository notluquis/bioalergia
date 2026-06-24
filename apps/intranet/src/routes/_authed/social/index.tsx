import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";

import { SocialPage } from "@/features/social/pages/SocialPage";
import { type SocialTab, socialTabKey } from "@/features/social/types";
import { requirePermission } from "@/lib/authz/route-guards";

const searchSchema = z.object({
  tab: socialTabKey.optional().default("calendario"),
});

export const Route = createFileRoute("/_authed/social/")({
  staticData: {
    nav: { iconKey: "Megaphone", label: "Redes sociales", order: 30, section: "Comunicaciones" },
    permission: { action: "read", subject: "SocialPost" },
    relatedSubjects: ["SocialAccount", "SocialPostTarget"],
    title: "Redes sociales",
  },
  validateSearch: searchSchema,
  beforeLoad: requirePermission("read", "SocialPost"),
  component: SocialHostPage,
});

function SocialHostPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  const onTabChange = useCallback(
    (next: SocialTab) => {
      void navigate({ search: (prev) => ({ ...prev, tab: next }), replace: true });
    },
    [navigate]
  );

  return <SocialPage tab={tab} onTabChange={onTabChange} />;
}
