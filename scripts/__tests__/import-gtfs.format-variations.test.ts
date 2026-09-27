/** @jest-environment node */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

jest.setTimeout(30_000);

type PublicImportResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
};

type ImportSnapshot = {
  counts: {
    agencies: number;
    routes: number;
    stops: number;
    trips: number;
    stopTimes: number;
    calendars: number;
    calendarDates: number;
    shapes: number;
  };
  stopTimes: Array<{
    trip_id: string;
    stop_id: string;
    stop_sequence: number;
    pickup_type: number | null;
    drop_off_type: number | null;
  }>;
  shapeDistances: Array<number | null>;
};

type FixtureRun = {
  importResult: PublicImportResult;
  snapshotResult?: PublicImportResult;
  snapshot?: ImportSnapshot;
};

type FixtureMutation = (fixtureRoot: string) => void;

const projectRoot = path.resolve(__dirname, "../..");
const fixturePath = path.join(projectRoot, "ci", "gtfs");
const tsxCliPath = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");

const snapshotScript = `
  import { closeDb, openDb } from "gtfs";

  const sqlitePath = process.argv[1];
  let db;
  try {
    db = openDb({ sqlitePath });
    const read = (sql) => db.prepare(sql).all();
    const one = (sql) => db.prepare(sql).get().count;
    const snapshot = {
      counts: {
        agencies: one("SELECT COUNT(*) AS count FROM agency"),
        routes: one("SELECT COUNT(*) AS count FROM routes"),
        stops: one("SELECT COUNT(*) AS count FROM stops"),
        trips: one("SELECT COUNT(*) AS count FROM trips"),
        stopTimes: one("SELECT COUNT(*) AS count FROM stop_times"),
        calendars: one("SELECT COUNT(*) AS count FROM calendar"),
        calendarDates: one("SELECT COUNT(*) AS count FROM calendar_dates"),
        shapes: one("SELECT COUNT(*) AS count FROM shapes"),
      },
      stopTimes: read("SELECT trip_id, stop_id, stop_sequence, pickup_type, drop_off_type FROM stop_times ORDER BY trip_id, stop_sequence"),
      shapeDistances: read("SELECT shape_dist_traveled FROM stop_times ORDER BY trip_id, stop_sequence").map(({ shape_dist_traveled }) => shape_dist_traveled),
    };
    process.stdout.write(JSON.stringify(snapshot));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (db) closeDb(db);
  }
`;

function copyCliSandboxFile(relativePath: string, temporaryRoot: string): void {
  const destination = path.join(temporaryRoot, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(projectRoot, relativePath), destination);
}

function prepareCliSandbox(
  temporaryRoot: string,
  mutateFixture: FixtureMutation,
): string {
  copyCliSandboxFile("package.json", temporaryRoot);
  copyCliSandboxFile("tsconfig.json", temporaryRoot);
  copyCliSandboxFile("prisma/schema.prisma", temporaryRoot);
  copyCliSandboxFile("scripts/import-gtfs.ts", temporaryRoot);
  copyCliSandboxFile("scripts/gtfs-log-sanitizer.ts", temporaryRoot);
  copyCliSandboxFile("src/lib/config/config.ts", temporaryRoot);
  copyCliSandboxFile("src/utils/logger.ts", temporaryRoot);

  const sandboxFixturePath = path.join(temporaryRoot, "ci", "gtfs");
  mkdirSync(path.dirname(sandboxFixturePath), { recursive: true });
  cpSync(fixturePath, sandboxFixturePath, { recursive: true });
  mutateFixture(sandboxFixturePath);

  const sandboxNodeModules = path.join(temporaryRoot, "node_modules");
  mkdirSync(path.join(sandboxNodeModules, "@prisma"), { recursive: true });
  cpSync(
    path.join(projectRoot, "node_modules", ".prisma"),
    path.join(sandboxNodeModules, ".prisma"),
    { recursive: true },
  );
  cpSync(
    path.join(projectRoot, "node_modules", "@prisma", "client"),
    path.join(sandboxNodeModules, "@prisma", "client"),
    { recursive: true },
  );
  symlinkSync(
    path.join(projectRoot, "node_modules", "gtfs"),
    path.join(sandboxNodeModules, "gtfs"),
    "dir",
  );

  writeFileSync(
    path.join(temporaryRoot, "transit-config.json"),
    JSON.stringify(
      {
        sqlitePath: "prisma/.temp/data.db",
        agencies: [{ agency_key: "synthetic", path: "ci/gtfs" }],
        verbose: false,
      },
      null,
      2,
    ),
    "utf8",
  );

  return path.join(temporaryRoot, "prisma", ".temp", "data.db");
}

function runPublicImport(mutateFixture: FixtureMutation): FixtureRun {
  const temporaryRoot = mkdtempSync(
    path.join(tmpdir(), "transit-gtfs-format-cli-"),
  );
  const sqlitePath = prepareCliSandbox(temporaryRoot, mutateFixture);
  const env = {
    ...process.env,
    FORCE_COLOR: "0",
  };

  try {
    const importChild = spawnSync(
      process.execPath,
      [
        tsxCliPath,
        "--tsconfig",
        path.join(temporaryRoot, "tsconfig.json"),
        path.join(temporaryRoot, "scripts", "import-gtfs.ts"),
      ],
      {
        cwd: temporaryRoot,
        encoding: "utf8",
        env,
      },
    );
    const importResult: PublicImportResult = {
      status: importChild.status,
      stdout: importChild.stdout,
      stderr: importChild.stderr,
      error: importChild.error,
    };

    if (importChild.status !== 0 || importChild.error) {
      return { importResult };
    }

    const snapshotChild = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", snapshotScript, sqlitePath],
      {
        cwd: projectRoot,
        encoding: "utf8",
        env,
      },
    );
    const snapshotResult: PublicImportResult = {
      status: snapshotChild.status,
      stdout: snapshotChild.stdout,
      stderr: snapshotChild.stderr,
      error: snapshotChild.error,
    };

    if (snapshotChild.status !== 0 || snapshotChild.error) {
      return { importResult, snapshotResult };
    }

    return {
      importResult,
      snapshotResult,
      snapshot: JSON.parse(snapshotChild.stdout) as ImportSnapshot,
    };
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

function assertRequiredDataWasImported(run: FixtureRun): ImportSnapshot {
  expect(run.importResult.error).toBeUndefined();
  if (run.importResult.status !== 0) {
    throw new Error(`公開CLIの出力: ${JSON.stringify(run.importResult)}`);
  }
  expect(run.importResult.status).toBe(0);
  expect(run.importResult.stderr).toBe("");
  expect(run.importResult.stdout).toContain("スクリプトの実行が完了しました");
  expect(run.snapshotResult?.error).toBeUndefined();
  expect(run.snapshotResult?.status).toBe(0);
  expect(run.snapshotResult?.stderr).toBe("");
  expect(run.snapshot).toBeDefined();

  const snapshot = run.snapshot as ImportSnapshot;
  expect(snapshot.counts).toEqual({
    agencies: 1,
    routes: 1,
    stops: 2,
    trips: 1,
    stopTimes: 2,
    calendars: 1,
    calendarDates: 2,
    shapes: 2,
  });
  expect(snapshot.stopTimes).toEqual([
    {
      trip_id: "トリップ_日本語_0001",
      stop_id: "000001",
      stop_sequence: 1,
      pickup_type: 0,
      drop_off_type: 0,
    },
    {
      trip_id: "トリップ_日本語_0001",
      stop_id: "終端_000002",
      stop_sequence: 2,
      pickup_type: 1,
      drop_off_type: 1,
    },
  ]);

  return snapshot;
}

function mutateWithUtf8Bom(sandboxFixturePath: string): void {
  const filePath = path.join(sandboxFixturePath, "agency.txt");
  const contents = readFileSync(filePath);
  writeFileSync(
    filePath,
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), contents]),
  );
}

function rewriteFileLineEndings(
  sandboxFixturePath: string,
  relativePath: string,
  lineEnding: "\r\n" | "\n",
): string {
  const filePath = path.join(sandboxFixturePath, relativePath);
  const lines = readFileSync(filePath, "utf8").split(/\r\n|\n/);
  const contents = lines.join(lineEnding);
  writeFileSync(filePath, contents, "utf8");
  return contents;
}

function mutateWithMixedLineEndings(sandboxFixturePath: string): void {
  const crlfFile = rewriteFileLineEndings(
    sandboxFixturePath,
    "agency.txt",
    "\r\n",
  );
  const lfFile = rewriteFileLineEndings(sandboxFixturePath, "stops.txt", "\n");

  expect(crlfFile).toContain("\r\n");
  expect(crlfFile.replaceAll("\r\n", "")).not.toContain("\n");
  expect(lfFile).toContain("\n");
  expect(lfFile).not.toContain("\r\n");
}

function rewriteCsvColumns(
  sandboxFixturePath: string,
  relativePath: string,
  orderedHeaders: string[],
): void {
  const filePath = path.join(sandboxFixturePath, relativePath);
  const lines = readFileSync(filePath, "utf8").split(/\r\n|\n/);
  const headers = lines[0].split(",");
  const columnIndexes = orderedHeaders.map((header) => {
    const index = headers.indexOf(header);
    if (index < 0) {
      throw new Error(`Missing expected GTFS column: ${header}`);
    }
    return index;
  });
  const rows = lines.slice(1).map((line) => {
    if (line === "") {
      return "";
    }
    const fields = line.split(",");
    return columnIndexes.map((index) => fields[index] ?? "").join(",");
  });
  writeFileSync(
    filePath,
    [orderedHeaders.join(","), ...rows].join("\n"),
    "utf8",
  );
}

function mutateWithReorderedStopTimes(sandboxFixturePath: string): void {
  rewriteCsvColumns(sandboxFixturePath, "stop_times.txt", [
    "stop_sequence",
    "stop_id",
    "departure_time",
    "trip_id",
    "drop_off_type",
    "arrival_time",
    "timepoint",
    "stop_headsign",
    "pickup_type",
    "shape_dist_traveled",
  ]);
}

function mutateWithoutShapeDistance(sandboxFixturePath: string): void {
  const filePath = path.join(sandboxFixturePath, "stop_times.txt");
  const lines = readFileSync(filePath, "utf8").split(/\r\n|\n/);
  const headers = lines[0].split(",");
  const shapeDistanceIndex = headers.indexOf("shape_dist_traveled");
  if (shapeDistanceIndex < 0) {
    throw new Error("shape_dist_traveled is already absent from stop_times.txt");
  }
  const withoutShapeDistance = lines.map((line) => {
    if (line === "") {
      return "";
    }
    return line
      .split(",")
      .filter((_, index) => index !== shapeDistanceIndex)
      .join(",");
  });
  writeFileSync(filePath, withoutShapeDistance.join("\n"), "utf8");
}

const unchangedFixture: FixtureMutation = () => undefined;

describe("GTFS importer format variations through the public CLI", () => {
  it("accepts a UTF-8 BOM in a GTFS header and retains required data", () => {
    const run = runPublicImport((sandboxFixturePath) => {
      mutateWithUtf8Bom(sandboxFixturePath);
    });

    assertRequiredDataWasImported(run);
  });

  it("accepts CRLF and LF across GTFS files and retains required data", () => {
    const run = runPublicImport(mutateWithMixedLineEndings);

    assertRequiredDataWasImported(run);
  });

  it("resolves stop_times fields by header after the columns are reordered", () => {
    const run = runPublicImport(mutateWithReorderedStopTimes);

    assertRequiredDataWasImported(run);
  });

  it("accepts stop_times without the optional shape_dist_traveled column", () => {
    const run = runPublicImport(mutateWithoutShapeDistance);

    const snapshot = assertRequiredDataWasImported(run);
    expect(snapshot.shapeDistances).toEqual([null, null]);
  });

  it("accepts the fixture when optional fare_rules.txt is absent", () => {
    expect(existsSync(path.join(fixturePath, "fare_rules.txt"))).toBe(false);

    const snapshot = assertRequiredDataWasImported(runPublicImport(unchangedFixture));
    expect(snapshot.counts).toEqual(
      expect.objectContaining({
        agencies: 1,
        routes: 1,
        stops: 2,
        trips: 1,
        stopTimes: 2,
      }),
    );
  });
});
