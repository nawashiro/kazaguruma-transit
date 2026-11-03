import { existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPrismaClient } from "../create-prisma-client";

jest.mock("@prisma/adapter-better-sqlite3", () => ({
  __esModule: true,
  PrismaBetterSqlite3: jest.fn(() => ({})),
}));

jest.mock("../../../generated/prisma/client", () => ({
  __esModule: true,
  PrismaClient: jest.fn(() => ({})),
}));

describe("createPrismaClient", () => {
  test("creates the sqlite directory before the adapter opens the path", () => {
    const base = mkdtempSync(path.join(os.tmpdir(), "prisma-sqlite-dir-"));
    const nested = path.join(base, "missing", "parent", "data.db");

    expect(existsSync(path.dirname(nested))).toBe(false);
    expect(() => createPrismaClient(nested)).not.toThrow();
    expect(existsSync(path.dirname(nested))).toBe(true);
    expect(existsSync(nested)).toBe(false);
  });

  test("skips directory creation for an in-memory database", () => {
    const base = mkdtempSync(path.join(os.tmpdir(), "prisma-sqlite-mem-"));
    expect(() => createPrismaClient(":memory:")).not.toThrow();
    expect(existsSync(path.join(base, ":memory:"))).toBe(false);
  });
});
