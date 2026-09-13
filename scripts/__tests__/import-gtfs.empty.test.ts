/** @jest-environment node */

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type PublicImportResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

const projectRoot = path.resolve(__dirname, "../..");
const importScriptPath = path.join(projectRoot, "scripts/import-gtfs.ts");
const tsxCliPath = path.join(projectRoot, "node_modules/tsx/dist/cli.mjs");
const tsconfigPath = path.join(projectRoot, "tsconfig.json");

function runPublicImportWithEmptyGtfs(): PublicImportResult {
  const cwd = mkdtempSync(path.join(tmpdir(), "transit-empty-gtfs-"));

  try {
    mkdirSync(path.join(cwd, "gtfs-empty"));
    writeFileSync(
      path.join(cwd, "transit-config.json"),
      JSON.stringify({
        sqlitePath: "prisma/.temp/data.db",
        agencies: [
          {
            agency_key: "synthetic",
            path: "gtfs-empty",
          },
        ],
        verbose: false,
      }),
      "utf8",
    );

    const result = spawnSync(
      process.execPath,
      [tsxCliPath, "--tsconfig", tsconfigPath, importScriptPath],
      {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          FORCE_COLOR: "0",
        },
        timeout: 30_000,
      },
    );

    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      error: result.error,
    };
  } finally {
    rmSync(cwd, { force: true, recursive: true });
  }
}

describe("public GTFS import empty-data boundary", () => {
  it("exits non-zero when an empty GTFS input only produces the empty-data warning", () => {
    const result = runPublicImportWithEmptyGtfs();
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.error).toBeUndefined();
    expect(output).toMatch(/データがインポートされていない/);
    expect(result.status).toBe(1);
  });
});
