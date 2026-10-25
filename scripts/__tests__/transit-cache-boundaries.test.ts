/** @jest-environment node */

import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const tsx = path.join(root, "node_modules/tsx/dist/cli.mjs");

function run(cwd: string, script = path.join(root, "scripts/import-gtfs.ts")) {
  const child = spawn(process.execPath, [tsx, "--tsconfig", path.join(root, "tsconfig.json"), script], {
    cwd, env: {...process.env, FORCE_COLOR: "0"}, stdio: "pipe",
  });
  let output = "";
  child.stdout.on("data", (data) => { output += data; });
  child.stderr.on("data", (data) => { output += data; });
  return new Promise<{status: number | null; output: string}>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status) => resolve({status, output}));
  });
}

function setup(sqlitePath = "cache/runtime.db") {
  const cwd = mkdtempSync(path.join(tmpdir(), "transit-boundary-"));
  cpSync(path.join(root, "ci/gtfs"), path.join(cwd, "gtfs"), {recursive: true});
  const config = {sqlitePath, agencies: [{agency_key: "synthetic", path: "gtfs"}], verbose: false};
  const configFile = path.join(cwd, "transit-config.json");
  writeFileSync(configFile, JSON.stringify(config));
  return {cwd, config, configFile, db: path.resolve(cwd, sqlitePath)};
}

it.each(["absent", "old-schema", "corrupt", "absolute"])("rebuilds %s and preserves input and unrelated files", async (mode) => {
  const sandbox = setup();
  const {cwd, config, configFile} = sandbox;
  const db = mode === "absolute" ? path.join(cwd, "absolute/custom.db") : sandbox.db;
  config.sqlitePath = mode === "absolute" ? db : config.sqlitePath;
  writeFileSync(configFile, JSON.stringify(config));
  const originalConfig = readFileSync(configFile);
  const originalInput = readFileSync(path.join(cwd, "gtfs/stops.txt"));
  const other = path.join(cwd, "other.db");
  writeFileSync(other, "unrelated database");
  try {
    if (mode !== "absent") {
      mkdirSync(path.dirname(db), {recursive: true});
      if (mode === "old-schema") {
        const seed = path.join(cwd, "seed.mts");
        writeFileSync(seed, `import Database from ${JSON.stringify(path.join(root, "node_modules/better-sqlite3/lib/index.js"))};
          const db = new Database(${JSON.stringify(db)}); db.exec('CREATE TABLE legacy (value TEXT);'); db.close();`);
        expect(await run(cwd, seed)).toMatchObject({status: 0});
      } else writeFileSync(db, "not sqlite");
      for (const suffix of ["-wal", "-shm", "-journal"]) writeFileSync(db + suffix, "old sidecar");
    }
    const result = await run(cwd);
    expect(result).toMatchObject({status: 0});
    expect(readFileSync(db).subarray(0, 15).toString()).toBe("SQLite format 3");
    for (const suffix of ["-wal", "-shm", "-journal"]) {
      if (existsSync(db + suffix)) expect(readFileSync(db + suffix).toString()).not.toBe("old sidecar");
    }
    expect(readFileSync(configFile)).toEqual(originalConfig);
    expect(readFileSync(path.join(cwd, "gtfs/stops.txt"))).toEqual(originalInput);
    expect(readFileSync(other, "utf8")).toBe("unrelated database");
  } finally { rmSync(cwd, {recursive: true, force: true}); }
}, 30_000);

it("accepts service dates defined only by calendar_dates", async () => {
  const {cwd} = setup();
  try {
    rmSync(path.join(cwd, "gtfs/calendar.txt"));
    expect(await run(cwd)).toMatchObject({status: 0});
  } finally { rmSync(cwd, {recursive: true, force: true}); }
}, 30_000);

it("fails when the cache cannot be deleted and recovers after correcting the path", async () => {
  const {cwd, db} = setup();
  try {
    mkdirSync(db, {recursive: true});
    writeFileSync(path.join(db, "keep"), "keep");
    expect(await run(cwd)).toMatchObject({status: 1});
    expect(readFileSync(path.join(db, "keep"), "utf8")).toBe("keep");
    rmSync(db, {recursive: true});
    expect(await run(cwd)).toMatchObject({status: 0});
  } finally { rmSync(cwd, {recursive: true, force: true}); }
}, 30_000);

it("rejects a failed GTFS download even with an existing valid cache and recovers", async () => {
  const {cwd, configFile} = setup();
  const server = createServer((_request, response) => { response.writeHead(503); response.end("Unavailable"); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No HTTP port");
  try {
    expect(await run(cwd)).toMatchObject({status: 0});
    writeFileSync(configFile, JSON.stringify({sqlitePath: "cache/runtime.db", agencies: [{agency_key: "synthetic", url: `http://127.0.0.1:${address.port}/feed.zip`}], verbose: false}));
    expect(await run(cwd)).toMatchObject({status: 1});
    writeFileSync(configFile, JSON.stringify({sqlitePath: "cache/runtime.db", agencies: [{agency_key: "synthetic", path: "gtfs"}], verbose: false}));
    expect(await run(cwd)).toMatchObject({status: 0});
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(cwd, {recursive: true, force: true});
  }
}, 30_000);


it("does not reuse the cache after schema creation fails and recovers", async () => {
  const {cwd, db} = setup();
  try {
    expect(await run(cwd)).toMatchObject({status: 0});
    mkdirSync(path.join(cwd, "scripts"));
    for (const file of ["import-gtfs.ts", "gtfs-log-sanitizer.ts"]) {
      cpSync(path.join(root, "scripts", file), path.join(cwd, "scripts", file));
    }
    for (const directory of ["src", "node_modules", "prisma"]) {
      symlinkSync(path.join(root, directory), path.join(cwd, directory), "dir");
    }
    writeFileSync(path.join(cwd, "prisma.config.ts"), `import {defineConfig} from "prisma/config";
      export default defineConfig({schema: "missing.prisma", datasource: {url: "file:${db}"}});`);
    const script = path.join(cwd, "scripts/import-gtfs.ts");
    const result = await run(cwd, script);
    expect(result.status).toBe(1);
    expect(result.output).toContain("Prismaスキーマの作成に失敗しました");
    expect(existsSync(db)).toBe(false);
    cpSync(path.join(root, "prisma.config.ts"), path.join(cwd, "prisma.config.ts"));
    expect(await run(cwd, script)).toMatchObject({status: 0});
  } finally { rmSync(cwd, {recursive: true, force: true}); }
}, 30_000);

it("rejects missing required transit rows and replaces the partial cache on retry", async () => {
  const {cwd} = setup();
  const input = path.join(cwd, "gtfs/stop_times.txt");
  const original = readFileSync(input);
  try {
    expect(await run(cwd)).toMatchObject({status: 0});
    writeFileSync(input, original.toString().split("\n")[0] + "\n");
    const result = await run(cwd);
    expect(result.status).toBe(1);
    expect(result.output).toContain("必須のGTFSデータが不足しています");
    writeFileSync(input, original);
    expect(await run(cwd)).toMatchObject({status: 0});
  } finally { rmSync(cwd, {recursive: true, force: true}); }
}, 30_000);
