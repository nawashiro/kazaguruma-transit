/** @jest-environment node */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
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

type FixtureSnapshot = {
  agencies: Array<Record<string, unknown>>;
  routes: Array<Record<string, unknown>>;
  stops: Array<Record<string, unknown>>;
  trips: Array<Record<string, unknown>>;
  stopTimes: Array<Record<string, unknown>>;
  calendars: Array<Record<string, unknown>>;
  calendarDates: Array<Record<string, unknown>>;
  shapes: Array<Record<string, unknown>>;
};

type FixtureRun = {
  importResult: PublicImportResult;
  snapshotResult?: PublicImportResult;
  snapshot?: FixtureSnapshot;
};

const projectRoot = path.resolve(__dirname, "../..");
const fixturePath = path.join(projectRoot, "ci", "gtfs");
const importScriptPath = path.join(projectRoot, "scripts", "import-gtfs.ts");
const tsxCliPath = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
const tsconfigPath = path.join(projectRoot, "tsconfig.json");

const snapshotScript = `
  import { closeDb, openDb } from "gtfs";

  const sqlitePath = process.argv[1];
  let db;
  try {
    db = openDb({ sqlitePath });
    const read = (sql) => db.prepare(sql).all();
    const snapshot = {
      agencies: read("SELECT agency_id, agency_name, agency_phone, agency_email FROM agency ORDER BY agency_id"),
      routes: read("SELECT route_id, agency_id, route_short_name, route_long_name, route_desc, route_url FROM routes ORDER BY route_id"),
      stops: read("SELECT stop_id, stop_name, stop_code, stop_desc, zone_id, stop_url FROM stops ORDER BY stop_id"),
      trips: read("SELECT trip_id, route_id, service_id, trip_short_name, shape_id, block_id FROM trips ORDER BY trip_id"),
      stopTimes: read("SELECT trip_id, stop_id, stop_sequence, pickup_type, drop_off_type, stop_headsign FROM stop_times ORDER BY trip_id, stop_sequence"),
      calendars: read("SELECT service_id, start_date, end_date FROM calendar ORDER BY service_id"),
      calendarDates: read("SELECT service_id, date, exception_type FROM calendar_dates ORDER BY service_id, date"),
      shapes: read("SELECT shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence FROM shapes ORDER BY shape_id, shape_pt_sequence"),
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

function prepareCliSandbox(temporaryRoot: string): string {
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

function runFixtureImport(): FixtureRun {
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "transit-gtfs-fixture-cli-"));
  const sqlitePath = prepareCliSandbox(temporaryRoot);
  const env = {
    ...process.env,
    FORCE_COLOR: "0",
  };

  try {
    const importChild = spawnSync(
      process.execPath,
      [tsxCliPath, "--tsconfig", path.join(temporaryRoot, "tsconfig.json"), path.join(temporaryRoot, "scripts", "import-gtfs.ts")],
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
      snapshot: JSON.parse(snapshotChild.stdout) as FixtureSnapshot,
    };
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

describe("synthetic GTFS fixture import retention", () => {
  it("retains Unicode, zero-padded IDs, blank optionals, service exceptions, and terminal pickup/dropoff through the public CLI", () => {
    const run = runFixtureImport();

    expect(run.importResult.error).toBeUndefined();
    expect(run.importResult.status).toBe(0);
    expect(run.importResult.stderr).toBe("");
    expect(run.importResult.stdout).toContain("スクリプトの実行が完了しました");
    expect(run.snapshotResult?.error).toBeUndefined();
    expect(run.snapshotResult?.status).toBe(0);
    expect(run.snapshotResult?.stderr).toBe("");
    expect(run.snapshot).toBeDefined();

    const snapshot = run.snapshot as FixtureSnapshot;
    expect(snapshot.agencies).toHaveLength(1);
    expect(snapshot.routes).toHaveLength(1);
    expect(snapshot.stops).toHaveLength(2);
    expect(snapshot.trips).toHaveLength(1);
    expect(snapshot.stopTimes).toHaveLength(2);
    expect(snapshot.calendars).toHaveLength(1);
    expect(snapshot.calendarDates).toHaveLength(2);
    expect(snapshot.shapes).toHaveLength(2);

    expect(snapshot.agencies[0]).toEqual({
      agency_id: "synthetic_agency_01",
      agency_name: "架空月虹交通",
      agency_phone: null,
      agency_email: null,
    });
    expect(snapshot.routes[0]).toEqual({
      route_id: "0007",
      agency_id: "synthetic_agency_01",
      route_short_name: null,
      route_long_name: "月虹循環",
      route_desc: null,
      route_url: null,
    });
    expect(snapshot.stops).toEqual([
      {
        stop_id: "000001",
        stop_name: "始端・灯",
        stop_code: null,
        stop_desc: null,
        zone_id: null,
        stop_url: null,
      },
      {
        stop_id: "終端_000002",
        stop_name: "終端・灯",
        stop_code: null,
        stop_desc: null,
        zone_id: null,
        stop_url: null,
      },
    ]);
    expect(snapshot.trips[0]).toEqual({
      trip_id: "トリップ_日本語_0001",
      route_id: "0007",
      service_id: "サービス_日本語_01",
      trip_short_name: null,
      shape_id: "shape_0007",
      block_id: null,
    });
    expect(snapshot.stopTimes).toEqual([
      {
        trip_id: "トリップ_日本語_0001",
        stop_id: "000001",
        stop_sequence: 1,
        pickup_type: 0,
        drop_off_type: 0,
        stop_headsign: null,
      },
      {
        trip_id: "トリップ_日本語_0001",
        stop_id: "終端_000002",
        stop_sequence: 2,
        pickup_type: 1,
        drop_off_type: 1,
        stop_headsign: null,
      },
    ]);
    expect(snapshot.calendars[0]).toEqual({
      service_id: "サービス_日本語_01",
      start_date: 20260101,
      end_date: 20261231,
    });
    expect(snapshot.calendarDates).toEqual([
      {
        service_id: "サービス_日本語_01",
        date: 20260704,
        exception_type: 1,
      },
      {
        service_id: "サービス_日本語_01",
        date: 20260705,
        exception_type: 2,
      },
    ]);
    expect(snapshot.shapes).toEqual([
      {
        shape_id: "shape_0007",
        shape_pt_lat: 12.345,
        shape_pt_lon: 45.678,
        shape_pt_sequence: 1,
      },
      {
        shape_id: "shape_0007",
        shape_pt_lat: 12.346,
        shape_pt_lon: 45.679,
        shape_pt_sequence: 2,
      },
    ]);

    expect(snapshot.routes[0].agency_id).toBe(snapshot.agencies[0].agency_id);
    expect(snapshot.trips[0].route_id).toBe(snapshot.routes[0].route_id);
    expect(snapshot.trips[0].service_id).toBe(snapshot.calendars[0].service_id);
    expect(snapshot.trips[0].shape_id).toBe(snapshot.shapes[0].shape_id);
    expect(snapshot.stopTimes.map(({ trip_id }) => trip_id)).toEqual([
      snapshot.trips[0].trip_id,
      snapshot.trips[0].trip_id,
    ]);
    expect(snapshot.stopTimes.map(({ stop_id }) => stop_id)).toEqual(
      snapshot.stops.map(({ stop_id }) => stop_id),
    );
  });
});
