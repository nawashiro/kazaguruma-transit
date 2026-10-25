import type { PrismaClient } from "../../generated/prisma/client";
import { loadConfig } from "../config/config";
import { createPrismaClient } from "./create-prisma-client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma || createPrismaClient(loadConfig().sqlitePath);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
