import { mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../generated/prisma/client";
import { getPrismaDatasourceUrl } from "../config/config";

export function createPrismaClient(sqlitePath: string): PrismaClient {
  // @prisma/adapter-better-sqlite3 7.10.1 は file: パスの親ディレクトリを自前では作らない。
  if (sqlitePath !== ":memory:") {
    mkdirSync(path.dirname(sqlitePath), { recursive: true });
  }
  return new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: getPrismaDatasourceUrl(sqlitePath),
    }),
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });
}
