import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../..");
const ensureScriptPath = path.join(projectRoot, "scripts/ensure-app-config.mjs");
const requiredConfigFiles = ["app-config.json", "app-config.local.json"];

describe("ensure-app-config deployment boundary", () => {
  const temporaryDirectories: string[] = [];

  function createProjectDirectory(): string {
    const directory = mkdtempSync(path.join(tmpdir(), "ensure-app-config-"));
    temporaryDirectories.push(directory);
    return directory;
  }

  function runEnsureScript(cwd: string) {
    return spawnSync(process.execPath, [ensureScriptPath], {
      cwd,
      encoding: "utf8",
    });
  }

  afterEach(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { force: true, recursive: true });
    }
    temporaryDirectories.length = 0;
  });

  it("succeeds when both environment configurations exist", () => {
    const cwd = createProjectDirectory();
    for (const fileName of requiredConfigFiles) {
      writeFileSync(path.join(cwd, fileName), "{}\n");
    }

    const result = runEnsureScript(cwd);

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
  });

  it.each(requiredConfigFiles)(
    "fails naming the missing %s and does not create it",
    (missingFile) => {
      const cwd = createProjectDirectory();
      for (const fileName of requiredConfigFiles) {
        if (fileName !== missingFile) {
          writeFileSync(path.join(cwd, fileName), "{}\n");
        }
      }

      const result = runEnsureScript(cwd);

      expect(result.error).toBeUndefined();
      expect(result.status).not.toBeNull();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(missingFile);
      expect(existsSync(path.join(cwd, missingFile))).toBe(false);
    },
  );

  it("fails from a cwd with only the template and does not generate configuration", () => {
    const cwd = createProjectDirectory();
    writeFileSync(path.join(cwd, "app-config.json.example"), "{}\n");

    const result = runEnsureScript(cwd);

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    for (const fileName of requiredConfigFiles) {
      expect(result.stderr).toContain(fileName);
      expect(existsSync(path.join(cwd, fileName))).toBe(false);
    }
  });
});
