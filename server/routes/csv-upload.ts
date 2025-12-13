import { Router, Response } from "express";
import { z } from "zod";
import { authenticate } from "../lib/index.js";
import { prisma } from "../prisma.js";
import type { AuthenticatedRequest } from "../types.js";

const router = Router();

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
  daily_production_balances: z.object({
    balanceDate: z.string().refine((d) => !isNaN(Date.parse(d))),
    ingresoTarjetas: z.coerce.number().default(0),
    ingresoTransferencias: z.coerce.number().default(0),
    ingresoEfectivo: z.coerce.number().default(0),
    gastosDiarios: z.coerce.number().default(0),
    otrosAbonos: z.coerce.number().default(0),
    consultasMonto: z.coerce.number().default(0),
    controlesMonto: z.coerce.number().default(0),
    testsMonto: z.coerce.number().default(0),
    vacunasMonto: z.coerce.number().default(0),
    licenciasMonto: z.coerce.number().default(0),
    roxairMonto: z.coerce.number().default(0),
    comentarios: z.string().optional(),
    status: z.enum(["DRAFT", "FINAL"]).default("DRAFT"),
    changeReason: z.string().optional(),
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
router.post("/preview", authenticate, async (req: AuthenticatedRequest, res: Response) => {
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

      const parsed = validation.data as typeof row;

      // Verificar si existe (para tablas con RUT)
      if (table === "people" && parsed.rut) {
        const exists = await findPersonByRut(parsed.rut);
        if (exists) {
          toUpdate++;
        } else {
          toInsert++;
        }
      } else if (table === "employees" || table === "counterparts" || table === "employee_timesheets") {
        if (parsed.rut) {
          const person = await findPersonByRut(parsed.rut);
          if (!person) {
            errors.push(`Fila ${i + 1}: Persona con RUT ${parsed.rut} no existe`);
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
                workDate: new Date(parsed.workDate),
              },
            });
            if (exists) toUpdate++;
            else toInsert++;
          }
        }
      } else if (table === "daily_balances" && parsed.date) {
        const exists = await prisma.dailyBalance.findUnique({ where: { date: new Date(parsed.date) } });
        if (exists) toUpdate++;
        else toInsert++;
      } else if (table === "daily_production_balances" && parsed.balanceDate) {
        const exists = await prisma.dailyProductionBalance.findUnique({
          where: { balanceDate: new Date(parsed.balanceDate) },
        });
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
router.post("/import", authenticate, async (req: AuthenticatedRequest, res: Response) => {
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

      const parsed = validation.data as typeof row;

      try {
        if (table === "people") {
          const existing = await findPersonByRut(parsed.rut);
          const personData = {
            names: parsed.names,
            fatherName: parsed.fatherName || null,
            motherName: parsed.motherName || null,
            email: parsed.email || null,
            phone: parsed.phone || null,
            address: parsed.address || null,
            personType: parsed.personType || "NATURAL",
          };

          if (existing) {
            await prisma.person.update({ where: { id: existing.id }, data: personData });
            updated++;
          } else {
            await prisma.person.create({
              data: {
                rut: parsed.rut,
                ...personData,
              },
            });
            inserted++;
          }
        } else if (table === "employees") {
          const person = await findPersonByRut(parsed.rut);
          if (!person) {
            errors.push(`Fila ${i + 1}: Persona con RUT ${parsed.rut} no existe`);
            skipped++;
            continue;
          }

          const employeeData = {
            position: parsed.position,
            department: parsed.department || null,
            startDate: new Date(parsed.startDate),
            endDate: parsed.endDate ? new Date(parsed.endDate) : null,
            status: parsed.status || "ACTIVE",
            salaryType: parsed.salaryType || "FIXED",
            baseSalary: parsed.baseSalary || 0,
            hourlyRate: parsed.hourlyRate || null,
            overtimeRate: parsed.overtimeRate || null,
            retentionRate: parsed.retentionRate || 0.145,
            bankName: parsed.bankName || null,
            bankAccountType: parsed.bankAccountType || null,
            bankAccountNumber: parsed.bankAccountNumber || null,
          };

          const existing = await prisma.employee.findUnique({ where: { personId: person.id } });
          if (existing) {
            await prisma.employee.update({ where: { id: existing.id }, data: employeeData });
            updated++;
          } else {
            await prisma.employee.create({ data: { ...employeeData, personId: person.id } });
            inserted++;
          }
        } else if (table === "counterparts") {
          const person = await findPersonByRut(parsed.rut);
          if (!person) {
            errors.push(`Fila ${i + 1}: Persona con RUT ${parsed.rut} no existe`);
            skipped++;
            continue;
          }

          const counterpartData = {
            category: parsed.category || "OTHER",
            notes: parsed.notes || null,
          };

          const existing = await prisma.counterpart.findUnique({ where: { personId: person.id } });
          if (existing) {
            await prisma.counterpart.update({ where: { id: existing.id }, data: counterpartData });
            updated++;
          } else {
            await prisma.counterpart.create({ data: { ...counterpartData, personId: person.id } });
            inserted++;
          }
        } else if (table === "transactions") {
          let personId = null;
          if (parsed.rut) {
            const person = await findPersonByRut(parsed.rut);
            if (person) personId = person.id;
          }

          await prisma.transaction.create({
            data: {
              timestamp: new Date(parsed.timestamp),
              description: parsed.description || null,
              amount: parsed.amount,
              direction: parsed.direction,
              personId,
              origin: parsed.origin || null,
              destination: parsed.destination || null,
              category: parsed.category || null,
            },
          });
          inserted++;
        } else if (table === "daily_balances") {
          const dailyBalanceData = {
            amount: parsed.amount,
            note: parsed.note || null,
          };
          const existing = await prisma.dailyBalance.findUnique({ where: { date: new Date(parsed.date) } });
          if (existing) {
            await prisma.dailyBalance.update({ where: { id: existing.id }, data: dailyBalanceData });
            updated++;
          } else {
            await prisma.dailyBalance.create({
              data: { ...dailyBalanceData, date: new Date(parsed.date) },
            });
            inserted++;
          }
        } else if (table === "daily_production_balances") {
          const userId = req.auth?.userId;
          if (!userId) {
            errors.push(`Fila ${i + 1}: Usuario no autenticado`);
            skipped++;
            continue;
          }

          const productionData = {
            ingresoTarjetas: parsed.ingresoTarjetas ?? 0,
            ingresoTransferencias: parsed.ingresoTransferencias ?? 0,
            ingresoEfectivo: parsed.ingresoEfectivo ?? 0,
            gastosDiarios: parsed.gastosDiarios ?? 0,
            otrosAbonos: parsed.otrosAbonos ?? 0,
            consultasMonto: parsed.consultasMonto ?? 0,
            controlesMonto: parsed.controlesMonto ?? 0,
            testsMonto: parsed.testsMonto ?? 0,
            vacunasMonto: parsed.vacunasMonto ?? 0,
            licenciasMonto: parsed.licenciasMonto ?? 0,
            roxairMonto: parsed.roxairMonto ?? 0,
            comentarios: parsed.comentarios || null,
            status: parsed.status ?? "DRAFT",
            changeReason: parsed.changeReason || null,
          };

          const existing = await prisma.dailyProductionBalance.findUnique({
            where: { balanceDate: new Date(parsed.balanceDate) },
          });

          if (existing) {
            await prisma.dailyProductionBalance.update({
              where: { id: existing.id },
              data: productionData,
            });
            updated++;
          } else {
            await prisma.dailyProductionBalance.create({
              data: {
                ...productionData,
                balanceDate: new Date(parsed.balanceDate),
                createdBy: userId,
              },
            });
            inserted++;
          }
        } else if (table === "services") {
          let counterpartId = null;
          if (parsed.rut) {
            const person = await findPersonByRut(parsed.rut);
            if (person?.counterpart) counterpartId = person.counterpart.id;
          }

          await prisma.service.create({
            data: {
              name: parsed.name,
              counterpartId,
              type: parsed.type || "BUSINESS",
              frequency: parsed.frequency || "MONTHLY",
              defaultAmount: parsed.defaultAmount || 0,
              status: parsed.status || "ACTIVE",
            },
          });
          inserted++;
        } else if (table === "inventory_items") {
          await prisma.inventoryItem.create({
            data: {
              categoryId: parsed.categoryId || null,
              name: parsed.name,
              description: parsed.description || null,
              currentStock: parsed.currentStock || 0,
            },
          });
          inserted++;
        } else if (table === "employee_timesheets") {
          const person = await findPersonByRut(parsed.rut);
          if (!person?.employee) {
            errors.push(`Fila ${i + 1}: Empleado con RUT ${parsed.rut} no existe`);
            skipped++;
            continue;
          }

          const workDate = new Date(parsed.workDate);
          const timesheetData = {
            startTime: parsed.startTime || null,
            endTime: parsed.endTime || null,
            workedMinutes: parsed.workedMinutes,
            overtimeMinutes: parsed.overtimeMinutes || 0,
            comment: parsed.comment || null,
          };

          const existing = await prisma.employeeTimesheet.findFirst({
            where: {
              employeeId: person.employee.id,
              workDate,
            },
          });

          if (existing) {
            await prisma.employeeTimesheet.update({ where: { id: existing.id }, data: timesheetData });
            updated++;
          } else {
            await prisma.employeeTimesheet.create({
              data: {
                employeeId: person.employee.id,
                workDate,
                ...timesheetData,
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
