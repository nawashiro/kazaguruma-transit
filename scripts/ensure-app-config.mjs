import { existsSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const appConfigPath = resolve(projectRoot, "app-config.json");

if (existsSync(appConfigPath)) {
  process.stdout.write("app-config.json exists; keeping the deployment-specific configuration.\n");
} else {
  process.stderr.write(
    `app-config.json is required but was not found: ${appConfigPath}\n`,
  );
  process.exitCode = 1;
}
