import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AcceptInvitePage } from "@/features/auth/pages/AcceptInvitePage";

const acceptSearchSchema = z.object({
  token: z.string().optional(),
});

export const Route = createFileRoute("/accept-invite")({
  validateSearch: acceptSearchSchema,
  component: AcceptInvitePage,
});
