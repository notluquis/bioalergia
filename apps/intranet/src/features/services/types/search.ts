import { z } from "zod";

export const servicesSearchSchema = z.object({
  tab: z.enum(["overview", "agenda"]).default("overview"),
});

export type ServicesSearch = z.infer<typeof servicesSearchSchema>;
