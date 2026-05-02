import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { personalFinanceQueries } from "@/features/personal-finance/queries";
import { PersonalPage } from "@/features/personal-finance/pages/PersonalPage";

const searchSchema = z.object({
  tab: z.enum(["creditos", "servicios", "gastos"]).catch("creditos"),
});

export const Route = createFileRoute("/_authed/finanzas/personal")({
  validateSearch: searchSchema,
  staticData: {
    nav: { iconKey: "User", label: "Personal", order: 21, section: "Finanzas" },
    permission: { action: "read", subject: "PersonalCredit" },
    breadcrumb: "Personal",
  },
  beforeLoad: ({ context }) => {
    if (!context.can("read", "PersonalCredit")) {
      throw new Error("Unauthorized");
    }
  },
  component: PersonalPage,
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(personalFinanceQueries.list());
  },
});
