import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";
import { CONFIG_PATH, getPrismaDatasourceUrl, loadConfig } from "./src/lib/config/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: existsSync(CONFIG_PATH)
    ? { url: getPrismaDatasourceUrl(loadConfig().sqlitePath) }
    : undefined,
});
