/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type FailureCase = {
  name: string;
  config?: string;
  errorClassification: RegExp;
};

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

const missingGtfsConfig = JSON.stringify({
  sqlitePath: "prisma/.temp/data.db",
  agencies: [
    {
      agency_key: "synthetic",
      path: "gtfs/does-not-exist.zip",
    },
  ],
  verbose: false,
});

const failureCases: FailureCase[] = [
  {
    name: "missing transit-config",
    errorClassification: /設定ファイルの読み込みに失敗しました/,
  },
  {
    name: "malformed transit-config JSON",
    config: '{"sqlitePath":',
    errorClassification: /設定ファイルの読み込みに失敗しました/,
  },
  {
    name: "transit-config without the required agency input",
    config: JSON.stringify({
      sqlitePath: "prisma/.temp/data.db",
      agencies: [],
      verbose: false,
    }),
    errorClassification: /No `agencies` specified in config/,
  },
  {
    name: "configured GTFS input source does not exist",
    config: missingGtfsConfig,
    errorClassification: /GTFS.*(?:見つかりません|not found|存在)/i,
  },
];

function runPublicImport(config?: string): PublicImportResult {
  const cwd = mkdtempSync(path.join(tmpdir(), "transit-config-import-"));

  try {
    if (config !== undefined) {
      writeFileSync(path.join(cwd, "transit-config.json"), config, "utf8");
    }

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

describe("public GTFS import failure boundary", () => {
  it.each(failureCases)(
    "$name exits non-zero and reports the input failure",
    ({ config, errorClassification }) => {
      const result = runPublicImport(config);
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.error).toBeUndefined();
      expect(output).toMatch(errorClassification);
      expect(result.status).toBe(1);
    },
  );
});
