import { existsSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const requiredConfigFiles = ["app-config.json", "app-config.local.json"];
const missingConfigFiles = requiredConfigFiles.filter(
  (fileName) => !existsSync(resolve(projectRoot, fileName)),
);

if (missingConfigFiles.length === 0) {
  process.stdout.write(
    "app-config.json and app-config.local.json exist; keeping the deployment-specific configuration.\n",
  );
} else {
  process.stderr.write(
    `公開アプリ設定が見つかりません: ${missingConfigFiles.join(", ")}\n` +
      "app-config.json.example から app-config.json と app-config.local.json を作成してください。\n",
  );
  process.exitCode = 1;
}
