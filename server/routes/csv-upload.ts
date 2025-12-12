import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { authenticate } from "../lib/index.js";

const router = Router();
const prisma = new PrismaClient();

// Esquemas de validación por tabla
const TABLE_SCHEMAS = {
  people: z.object({
    rut: z.string().min(1),
    names: z.string().min(1),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    personType: z.enum(["NATURAL", "JURIDICAL"]).optional(),
  }),
  employees: z.object({
    rut: z.string().min(1),
    position: z.string().min(1),
    department: z.string().optional(),
    startDate: z.string().refine((d) => !isNaN(Date.parse(d))),
    endDate: z
      .string()
      .refine((d) => !isNaN(Date.parse(d)))
      .optional()
      .or(z.literal("")),
    status: z.enum(["ACTIVE", "INACTIVE", "TERMINATED"]).optional(),
    salaryType: z.enum(["HOURLY", "FIXED"]).optional(),
    baseSalary: z.coerce.number().optional(),
    hourlyRate: z.coerce.number().optional(),
    overtimeRate: z.coerce.number().optional(),
    retentionRate: z.coerce.number().optional(),
    bankName: z.string().optional(),
    bankAccountType: z.string().optional(),
    bankAccountNumber: z.string().optional(),
  }),
  counterparts: z.object({
    rut: z.string().min(1),
    category: z
      .enum(["SUPPLIER", "PATIENT", "EMPLOYEE", "PARTNER", "RELATED", "OTHER", "CLIENT", "LENDER", "OCCASIONAL"])
      .optional(),
    notes: z.string().optional(),
  }),
  transactions: z.object({
    timestamp: z.string().refine((d) => !isNaN(Date.parse(d))),
    description: z.string().optional(),
    amount: z.coerce.number(),
    direction: z.enum(["IN", "OUT", "NEUTRO"]),
    rut: z.string().optional(),
    origin: z.string().optional(),
    destination: z.string().optional(),
    category: z.string().optional(),
  }),
  daily_balances: z.object({
    date: z.string().refine((d) => !isNaN(Date.parse(d))),
    amount: z.coerce.number(),
    note: z.string().optional(),
  }),
  services: z.object({
    name: z.string().min(1),
    rut: z.string().optional(),
    type: z.enum(["BUSINESS", "PERSONAL", "SUPPLIER", "TAX", "UTILITY", "LEASE", "SOFTWARE", "OTHER"]).optional(),
    frequency: z
      .enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL", "ONCE"])
      .optional(),
    defaultAmount: z.coerce.number().optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  }),
  inventory_items: z.object({
    categoryId: z.coerce.number().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    currentStock: z.coerce.number().optional(),
  }),
  employee_timesheets: z.object({
    rut: z.string().min(1),
    workDate: z.string().refine((d) => !isNaN(Date.parse(d))),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    workedMinutes: z.coerce.number(),
    overtimeMinutes: z.coerce.number().optional(),
    comment: z.string().optional(),
  }),
};

type TableName = keyof typeof TABLE_SCHEMAS;

// Helper para encontrar persona por RUT
async function findPersonByRut(rut: string) {
  return await prisma.person.findUnique({
    where: { rut },
    include: { employee: true, counterpart: true },
  });
}

// Preview endpoint - valida los datos sin insertarlos
router.post("/preview", authenticate, async (req: Request, res: Response) => {
  try {
    const { table, data } = req.body;

    if (!table || !TABLE_SCHEMAS[table as TableName]) {
      return res.status(400).json({ error: "Tabla no válida" });
    }

    const schema = TABLE_SCHEMAS[table as TableName];
    const errors: string[] = [];
    let toInsert = 0;
    let toUpdate = 0;
    let toSkip = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Validar contra el schema
      const validation = schema.safeParse(row);
      if (!validation.success) {
        errors.push(
          `Fila ${i + 1}: ${validation.error.issues.map((e) => `${String(e.path.join("."))} - ${e.message}`).join(", ")}`
        );
        toSkip++;
        continue;
      }

      // Verificar si existe (para tablas con RUT)
      if (table === "people" && row.rut) {
        const exists = await findPersonByRut(row.rut);
        if (exists) {
          toUpdate++;
        } else {
          toInsert++;
        }
      } else if (table === "employees" || table === "counterparts" || table === "employee_timesheets") {
        if (row.rut) {
          const person = await findPersonByRut(row.rut);
          if (!person) {
            errors.push(`Fila ${i + 1}: Persona con RUT ${row.rut} no existe`);
            toSkip++;
            continue;
          }

          if (table === "employees") {
            const exists = await prisma.employee.findUnique({ where: { personId: person.id } });
            if (exists) toUpdate++;
            else toInsert++;
          } else if (table === "counterparts") {
            const exists = await prisma.counterpart.findUnique({ where: { personId: person.id } });
            if (exists) toUpdate++;
            else toInsert++;
          } else if (table === "employee_timesheets") {
            const exists = await prisma.employeeTimesheet.findFirst({
              where: {
                employeeId: person.employee?.id,
                workDate: new Date(row.workDate),
              },
            });
            if (exists) toUpdate++;
            else toInsert++;
          }
        }
      } else if (table === "daily_balances" && row.date) {
        const exists = await prisma.dailyBalance.findUnique({ where: { date: new Date(row.date) } });
        if (exists) toUpdate++;
        else toInsert++;
      } else {
        // Tablas sin unique constraint - siempre insertar
        toInsert++;
      }
    }

    res.json({
      toInsert,
      toUpdate,
      toSkip,
      errors: errors.slice(0, 20), // Limitar errores a 20
    });
  } catch (error) {
    console.error("Error en preview:", error);
    res.status(500).json({ error: "Error al procesar preview" });
  }
});

// Import endpoint - inserta/actualiza los datos
router.post("/import", authenticate, async (req: Request, res: Response) => {
  try {
    const { table, data } = req.body;

    if (!table || !TABLE_SCHEMAS[table as TableName]) {
      return res.status(400).json({ error: "Tabla no válida" });
    }

    const schema = TABLE_SCHEMAS[table as TableName];
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Validar
      const validation = schema.safeParse(row);
      if (!validation.success) {
        errors.push(
          `Fila ${i + 1}: ${validation.error.issues.map((e) => `${String(e.path.join("."))} - ${e.message}`).join(", ")}`
        );
        skipped++;
        continue;
      }

      try {
        if (table === "people") {
          const existing = await findPersonByRut(row.rut);
          if (existing) {
            await prisma.person.update({
              where: { id: existing.id },
              data: {
                names: row.names,
                fatherName: row.fatherName || null,
                motherName: row.motherName || null,
                email: row.email || null,
                phone: row.phone || null,
                address: row.address || null,
                personType: row.personType || "NATURAL",
              },
            });
            updated++;
          } else {
            await prisma.person.create({
              data: {
                rut: row.rut,
                names: row.names,
                fatherName: row.fatherName || null,
                motherName: row.motherName || null,
                email: row.email || null,
                phone: row.phone || null,
                address: row.address || null,
                personType: row.personType || "NATURAL",
              },
            });
            inserted++;
          }
        } else if (table === "employees") {
          const person = await findPersonByRut(row.rut);
          if (!person) {
            errors.push(`Fila ${i + 1}: Persona con RUT ${row.rut} no existe`);
            skipped++;
            continue;
          }

          const existing = await prisma.employee.findUnique({ where: { personId: person.id } });
          if (existing) {
            await prisma.employee.update({
              where: { id: existing.id },
              data: {
                position: row.position,
                department: row.department || null,
                startDate: new Date(row.startDate),
                endDate: row.endDate ? new Date(row.endDate) : null,
                status: row.status || "ACTIVE",
                salaryType: row.salaryType || "FIXED",
                baseSalary: row.baseSalary || 0,
                hourlyRate: row.hourlyRate || null,
                overtimeRate: row.overtimeRate || null,
                retentionRate: row.retentionRate || 0.145,
                bankName: row.bankName || null,
                bankAccountType: row.bankAccountType || null,
                bankAccountNumber: row.bankAccountNumber || null,
              },
            });
            updated++;
          } else {
            await prisma.employee.create({
              data: {
                personId: person.id,
                position: row.position,
                department: row.department || null,
                startDate: new Date(row.startDate),
                endDate: row.endDate ? new Date(row.endDate) : null,
                status: row.status || "ACTIVE",
                salaryType: row.salaryType || "FIXED",
                baseSalary: row.baseSalary || 0,
                hourlyRate: row.hourlyRate || null,
                overtimeRate: row.overtimeRate || null,
                retentionRate: row.retentionRate || 0.145,
                bankName: row.bankName || null,
                bankAccountType: row.bankAccountType || null,
                bankAccountNumber: row.bankAccountNumber || null,
              },
            });
            inserted++;
          }
        } else if (table === "counterparts") {
          const person = await findPersonByRut(row.rut);
          if (!person) {
            errors.push(`Fila ${i + 1}: Persona con RUT ${row.rut} no existe`);
            skipped++;
            continue;
          }

          const existing = await prisma.counterpart.findUnique({ where: { personId: person.id } });
          if (existing) {
            await prisma.counterpart.update({
              where: { id: existing.id },
              data: {
                category: row.category || "OTHER",
                notes: row.notes || null,
              },
            });
            updated++;
          } else {
            await prisma.counterpart.create({
              data: {
                personId: person.id,
                category: row.category || "OTHER",
                notes: row.notes || null,
              },
            });
            inserted++;
          }
        } else if (table === "transactions") {
          let personId = null;
          if (row.rut) {
            const person = await findPersonByRut(row.rut);
            if (person) personId = person.id;
          }

          await prisma.transaction.create({
            data: {
              timestamp: new Date(row.timestamp),
              description: row.description || null,
              amount: row.amount,
              direction: row.direction,
              personId,
              origin: row.origin || null,
              destination: row.destination || null,
              category: row.category || null,
            },
          });
          inserted++;
        } else if (table === "daily_balances") {
          const existing = await prisma.dailyBalance.findUnique({ where: { date: new Date(row.date) } });
          if (existing) {
            await prisma.dailyBalance.update({
              where: { id: existing.id },
              data: {
                amount: row.amount,
                note: row.note || null,
              },
            });
            updated++;
          } else {
            await prisma.dailyBalance.create({
              data: {
                date: new Date(row.date),
                amount: row.amount,
                note: row.note || null,
              },
            });
            inserted++;
          }
        } else if (table === "services") {
          let counterpartId = null;
          if (row.rut) {
            const person = await findPersonByRut(row.rut);
            if (person?.counterpart) counterpartId = person.counterpart.id;
          }

          await prisma.service.create({
            data: {
              name: row.name,
              counterpartId,
              type: row.type || "BUSINESS",
              frequency: row.frequency || "MONTHLY",
              defaultAmount: row.defaultAmount || 0,
              status: row.status || "ACTIVE",
            },
          });
          inserted++;
        } else if (table === "inventory_items") {
          await prisma.inventoryItem.create({
            data: {
              categoryId: row.categoryId || null,
              name: row.name,
              description: row.description || null,
              currentStock: row.currentStock || 0,
            },
          });
          inserted++;
        } else if (table === "employee_timesheets") {
          const person = await findPersonByRut(row.rut);
          if (!person?.employee) {
            errors.push(`Fila ${i + 1}: Empleado con RUT ${row.rut} no existe`);
            skipped++;
            continue;
          }

          const workDate = new Date(row.workDate);
          const existing = await prisma.employeeTimesheet.findFirst({
            where: {
              employeeId: person.employee.id,
              workDate,
            },
          });

          if (existing) {
            await prisma.employeeTimesheet.update({
              where: { id: existing.id },
              data: {
                startTime: row.startTime || null,
                endTime: row.endTime || null,
                workedMinutes: row.workedMinutes,
                overtimeMinutes: row.overtimeMinutes || 0,
                comment: row.comment || null,
              },
            });
            updated++;
          } else {
            await prisma.employeeTimesheet.create({
              data: {
                employeeId: person.employee.id,
                workDate,
                startTime: row.startTime || null,
                endTime: row.endTime || null,
                workedMinutes: row.workedMinutes,
                overtimeMinutes: row.overtimeMinutes || 0,
                comment: row.comment || null,
              },
            });
            inserted++;
          }
        }
      } catch (error) {
        console.error(`Error procesando fila ${i + 1}:`, error);
        errors.push(
          `Fila ${i + 1}: Error al procesar - ${error instanceof Error ? error.message : "Error desconocido"}`
        );
        skipped++;
      }
    }

    res.json({
      inserted,
      updated,
      skipped,
      total: data.length,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error("Error en import:", error);
    res.status(500).json({ error: "Error al importar datos" });
  }
});

export default router;
