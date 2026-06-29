import { createFileRoute } from "@tanstack/react-router";

import { legalDocuments } from "@/data/legal";
import { LegalDocPage } from "@/pages/LegalDocPage";

const doc = legalDocuments.dataDeletion;

function DataDeletionPage() {
  return <LegalDocPage document={doc} />;
}

export const Route = createFileRoute("/data-deletion")({
  component: DataDeletionPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/data-deletion`;
    return {
      meta: [
        { title: doc.seoTitle },
        { name: "description", content: doc.seoDescription },
        { property: "og:title", content: doc.seoTitle },
        { property: "og:description", content: doc.seoDescription },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
