import { z } from "zod";

// === BASIC TYPES ===

export const IdSchema = z.number().int().positive();
export const OptionalIdSchema = IdSchema.optional();

export const EmailSchema = z.string().trim().email("Debe ser un email válido").toLowerCase();

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Debe ser una fecha válida (YYYY-MM-DD)");

export const OptionalDateSchema = DateSchema.optional();

export const RutSchema = z
  .string()
  .trim()
  .regex(/^\d{1,8}-[\dkK]$/, "Debe ser un RUT válido (ej: 12345678-9)");

export const OptionalRutSchema = z.union([z.literal(""), RutSchema]).optional();

export const ColorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Debe ser un color hexadecimal válido");

export const HttpsUrlSchema = z
  .string()
  .trim()
  .url("Debe ser una URL válida")
  .refine((value) => value.startsWith("https://"), {
    message: "Debe comenzar con https://",
  });

export const OptionalHttpsUrlSchema = z.union([z.literal(""), HttpsUrlSchema]).optional();

// === CURRENCY ===

export const CurrencyAmountSchema = z
  .number()
  .finite("Debe ser un número válido")
  .multipleOf(0.01, "Máximo 2 decimales");

export const PositiveCurrencySchema = CurrencyAmountSchema.positive("Debe ser mayor a 0");

// === ENUMS ===

export const UserRoleSchema = z.enum(["GOD", "ADMIN", "ANALYST", "VIEWER"]);

export const CounterpartPersonTypeSchema = z.enum(["PERSON", "COMPANY", "OTHER"]);

export const CounterpartCategorySchema = z.enum([
  "SUPPLIER",
  "PATIENT",
  "EMPLOYEE",
  "PARTNER",
  "RELATED",
  "OTHER",
  "CLIENT",
  "LENDER",
  "OCCASIONAL",
]);

export const DirectionSchema = z.enum(["IN", "OUT"]);

export const LoanFrequencySchema = z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]);

export const LoanInterestTypeSchema = z.enum(["SIMPLE", "COMPOUND"]);

export const LoanStatusSchema = z.enum(["ACTIVE", "COMPLETED", "DEFAULTED"]);

export const ServiceFrequencySchema = z.enum([
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "ONCE",
]);

export const ServiceOwnershipSchema = z.enum(["COMPANY", "OWNER", "MIXED", "THIRD_PARTY"]);

export const ServiceObligationSchema = z.enum(["SERVICE", "DEBT", "LOAN", "OTHER"]);

export const ServiceRecurrenceSchema = z.enum(["RECURRING", "ONE_OFF"]);

export const ServiceIndexationSchema = z.enum(["NONE", "UF"]);

export const ServiceLateFeeModeSchema = z.enum(["NONE", "FIXED", "PERCENTAGE"]);

export const ServiceEmissionModeSchema = z.enum(["FIXED_DAY", "DATE_RANGE", "SPECIFIC_DATE"]);

// === PAGINATION ===

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// === QUERY FILTERS ===

export const DateRangeSchema = z.object({
  from: OptionalDateSchema,
  to: OptionalDateSchema,
});

export const SearchSchema = z.object({
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// === COMMON FORM SCHEMAS ===

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, "La contraseña es requerida"),
});

export const SettingsSchema = z.object({
  orgName: z.string().trim().min(1, "El nombre de la organización es requerido"),
  primaryColor: ColorSchema,
  secondaryColor: ColorSchema,
  logoUrl: OptionalHttpsUrlSchema,
  tagline: z.string().trim().optional(),
  contactEmail: EmailSchema.optional(),
  contactPhone: z.string().trim().optional(),
});

// === COUNTERPART SCHEMAS ===

export const CounterpartBaseSchema = z.object({
  rut: OptionalRutSchema,
  name: z.string().trim().min(1, "El nombre es requerido"),
  personType: CounterpartPersonTypeSchema,
  category: CounterpartCategorySchema,
  email: EmailSchema.optional(),
  employeeEmail: EmailSchema.optional(),
  notes: z.string().trim().optional(),
});

export const CreateCounterpartSchema = CounterpartBaseSchema;

export const UpdateCounterpartSchema = CounterpartBaseSchema.partial();

export const CounterpartAccountSchema = z.object({
  accountIdentifier: z.string().trim().min(1, "El identificador es requerido"),
  bankName: z.string().trim().optional(),
  accountType: z.string().trim().optional(),
  holder: z.string().trim().optional(),
  concept: z.string().trim().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// === TRANSACTION SCHEMAS ===

export const TransactionQuerySchema = z
  .object({
    from: OptionalDateSchema,
    to: OptionalDateSchema,
    description: z.string().trim().optional(),
    origin: z.string().trim().optional(),
    destination: z.string().trim().optional(),
    sourceId: z.string().trim().optional(),
    direction: DirectionSchema.optional(),
    file: z.string().trim().optional(),
    includeAmounts: z.coerce.boolean().default(false),
  })
  .merge(PaginationSchema);

// === EMPLOYEE SCHEMAS ===

export const EmployeeSchema = z.object({
  fullName: z.string().trim().min(1, "El nombre completo es requerido"),
  email: EmailSchema.optional(),
  role: z.string().trim().optional(),
  hourlyRate: PositiveCurrencySchema.optional(),
  isActive: z.boolean().default(true),
});

// === BALANCE SCHEMAS ===

export const BalanceSchema = z.object({
  date: DateSchema,
  balance: CurrencyAmountSchema,
  note: z.string().trim().optional(),
});

// === LOAN SCHEMAS ===

export const LoanSchema = z.object({
  publicId: z.string().trim().min(1),
  borrowerName: z.string().trim().min(1),
  principal: PositiveCurrencySchema,
  interestRate: z.number().min(0).max(100),
  interestType: LoanInterestTypeSchema,
  frequency: LoanFrequencySchema,
  startDate: DateSchema,
  endDate: DateSchema,
  description: z.string().trim().optional(),
});

// === SERVICE SCHEMAS ===

export const ServiceSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido"),
  description: z.string().trim().optional(),
  amount: PositiveCurrencySchema,
  frequency: ServiceFrequencySchema,
  ownership: ServiceOwnershipSchema,
  obligation: ServiceObligationSchema,
  recurrence: ServiceRecurrenceSchema,
  indexation: ServiceIndexationSchema,
  lateFeeMode: ServiceLateFeeModeSchema,
  emissionMode: ServiceEmissionModeSchema,
  isActive: z.boolean().default(true),
});
