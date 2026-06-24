import { oc } from "@orpc/contract";
import { z } from "zod";

// ── Reclamos / sugerencias (Decreto 35) ──────────────────────────────
export const complaintChannelSchema = z.enum(["PRESENCIAL", "WEB", "TELEFONO", "EMAIL", "LIBRO"]);
export const complaintStatusSchema = z.enum(["RECEIVED", "IN_PROGRESS", "RESOLVED", "ESCALATED"]);

export const complaintSchema = z.object({
  id: z.string(),
  channel: complaintChannelSchema,
  complainantName: z.string(),
  complainantRut: z.string().nullable(),
  contact: z.string().nullable(),
  patientId: z.number().int().nullable(),
  category: z.string().nullable(),
  description: z.string(),
  status: complaintStatusSchema,
  receivedAt: z.date(),
  dueAt: z.date(),
  resolvedAt: z.date().nullable(),
  resolution: z.string().nullable(),
  handledBy: z.number().int().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const listComplaintsInputSchema = z.object({
  status: complaintStatusSchema.optional(),
});
export const complaintsResponseSchema = z.object({
  complaints: z.array(complaintSchema),
});

export const createComplaintInputSchema = z.object({
  channel: complaintChannelSchema,
  complainantName: z.string().min(1),
  complainantRut: z.string().optional(),
  contact: z.string().optional(),
  patientId: z.number().int().optional(),
  category: z.string().optional(),
  description: z.string().min(1),
});

export const resolveComplaintInputSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["RESOLVED", "IN_PROGRESS", "ESCALATED"]),
  resolution: z.string().optional(),
});

// ── Libros foliados electrónicos ──────────────────────────────────────
export const foliatedBookSchema = z.enum(["PROCEDURES", "COMPLAINTS", "INSPECTIONS"]);

export const foliatedBookEntrySchema = z.object({
  id: z.string(),
  book: foliatedBookSchema,
  folio: z.number().int(),
  entryDate: z.date(),
  summary: z.string(),
  refType: z.string().nullable(),
  refId: z.string().nullable(),
  createdBy: z.number().int(),
  createdAt: z.date(),
});

export const listBookEntriesInputSchema = z.object({ book: foliatedBookSchema });
export const bookEntriesResponseSchema = z.object({
  entries: z.array(foliatedBookEntrySchema),
});

export const createBookEntryInputSchema = z.object({
  book: foliatedBookSchema,
  entryDate: z.string().min(1),
  summary: z.string().min(1),
  refType: z.string().optional(),
  refId: z.string().optional(),
});

export const complaintsContract = {
  listComplaints: oc
    .route({ method: "GET", path: "/complaints" })
    .input(listComplaintsInputSchema)
    .output(complaintsResponseSchema),
  createComplaint: oc
    .route({ method: "POST", path: "/complaints" })
    .input(createComplaintInputSchema)
    .output(complaintSchema),
  resolveComplaint: oc
    .route({ method: "POST", path: "/complaints/resolve" })
    .input(resolveComplaintInputSchema)
    .output(complaintSchema),
  listBookEntries: oc
    .route({ method: "GET", path: "/book" })
    .input(listBookEntriesInputSchema)
    .output(bookEntriesResponseSchema),
  createBookEntry: oc
    .route({ method: "POST", path: "/book" })
    .input(createBookEntryInputSchema)
    .output(foliatedBookEntrySchema),
};

export type ComplaintsContract = typeof complaintsContract;
export type ComplaintDto = z.infer<typeof complaintSchema>;
export type FoliatedBookEntryDto = z.infer<typeof foliatedBookEntrySchema>;
export type ComplaintChannel = z.infer<typeof complaintChannelSchema>;
export type ComplaintStatus = z.infer<typeof complaintStatusSchema>;
export type FoliatedBook = z.infer<typeof foliatedBookSchema>;
export type CreateComplaintInput = z.infer<typeof createComplaintInputSchema>;
export type ResolveComplaintInput = z.infer<typeof resolveComplaintInputSchema>;
export type CreateBookEntryInput = z.infer<typeof createBookEntryInputSchema>;
