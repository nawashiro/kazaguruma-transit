import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const appConfigPath = resolve(projectRoot, "app-config.json");
const appConfigExamplePath = resolve(projectRoot, "app-config.json.example");

if (existsSync(appConfigPath)) {
  process.stdout.write("app-config.json exists; keeping the deployment-specific configuration.\n");
} else if (existsSync(appConfigExamplePath)) {
  copyFileSync(appConfigExamplePath, appConfigPath);
  process.stdout.write("app-config.json was created from app-config.json.example.\n");
} else {
  process.stderr.write(
    `app-config.json.example was not found: ${appConfigExamplePath}\n`,
  );
  process.exitCode = 1;
}
