import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/lib/config/config";

const { sqlitePath } = loadConfig();

if (!existsSync(sqlitePath)) {
  mkdirSync(dirname(sqlitePath), { recursive: true });
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/prisma/build/index.js", import.meta.url)),
    "db", "push", "--config",
    fileURLToPath(new URL("../prisma.config.ts", import.meta.url)),
  ], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
