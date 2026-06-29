import { createFileRoute } from "@tanstack/react-router";

import { legalDocuments } from "@/data/legal";
import { LegalDocPage } from "@/pages/LegalDocPage";

const doc = legalDocuments.terms;

function TermsPage() {
  return <LegalDocPage document={doc} />;
}

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/terms`;
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
