// server/lib/authz/ability.ts
import { PureAbility, RawRuleOf } from "@casl/ability";
import { createPrismaAbility, PrismaQuery, Subjects } from "@casl/prisma";
import { User, Transaction, Role, Permission, Loan, Service } from "@prisma/client";

// Define Subjects including 'all' and Prisma models
export type AppSubjects =
  | Subjects<{
      User: User;
      Transaction: Transaction;
      Role: Role;
      Permission: Permission;
      Loan: Loan;
      Service: Service;
    }>
  | "all"
  | "Setting";

export type AppAbility = PureAbility<[string, AppSubjects], PrismaQuery>;

export function createAbility(rules: RawRuleOf<AppAbility>[]) {
  return createPrismaAbility(rules || []);
}
