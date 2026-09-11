import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../..");
const ensureScriptPath = path.join(projectRoot, "scripts/ensure-app-config.mjs");

describe("ensure-app-config deployment boundary", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { force: true, recursive: true });
    }
    temporaryDirectories.length = 0;
  });

  it("fails from a cwd with only the example and does not create app-config.json", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "ensure-app-config-"));
    temporaryDirectories.push(cwd);

    writeFileSync(
      path.join(cwd, "app-config.json.example"),
      '{"mainFacilitiesUri":"https://example.test/main.json"}\n',
    );
    const appConfigPath = path.join(cwd, "app-config.json");

    const result = spawnSync(process.execPath, [ensureScriptPath], {
      cwd,
      encoding: "utf8",
    });

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBeNull();
    expect(result.status).not.toBe(0);
    expect(existsSync(appConfigPath)).toBe(false);
  });
});
