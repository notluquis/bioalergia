// server/lib/authz/ability.ts
import { PureAbility, RawRuleOf } from "@casl/ability";
import { createPrismaAbility, PrismaQuery, Subjects } from "@casl/prisma";
import {
  Counterpart,
  DailyBalance,
  DailyProductionBalance,
  Employee,
  EmployeeTimesheet,
  Event,
  InventoryItem,
  Loan,
  Permission,
  Person,
  Role,
  Service,
  SupplyRequest,
  Transaction,
  User,
} from "@prisma/client";

// Define Subjects including 'all' and Prisma models
export type AppSubjects =
  | Subjects<{
      User: User;
      Transaction: Transaction;
      Role: Role;
      Permission: Permission;
      Loan: Loan;
      Service: Service;
      Employee: Employee;
      Counterpart: Counterpart;
      Timesheet: EmployeeTimesheet;
      CalendarEvent: Event;
      SupplyRequest: SupplyRequest;
      Person: Person;
      ProductionBalance: DailyProductionBalance;
      InventoryItem: InventoryItem;
      DailyBalance: DailyBalance;
    }>
  | "all"
  | "Setting"
  | "Report"
  | "BulkData"
  | "Security"
  | "Dashboard";

export type AppAbility = PureAbility<[string, AppSubjects], PrismaQuery>;

export function createAbility(rules: RawRuleOf<AppAbility>[]) {
  return createPrismaAbility(rules || []);
}
