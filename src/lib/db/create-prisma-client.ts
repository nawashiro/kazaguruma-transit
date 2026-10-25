import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client";
import { getPrismaDatasourceUrl } from "../config/config";

export function createPrismaClient(sqlitePath: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: getPrismaDatasourceUrl(sqlitePath),
    }),
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });
}
