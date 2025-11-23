import { PrismaClient } from "../generated/prisma/client.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma = new PrismaClient({} as any);
