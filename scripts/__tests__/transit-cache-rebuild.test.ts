/** @jest-environment node */

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../..");
const tsxCli = path.join(projectRoot, "node_modules/tsx/dist/cli.mjs");

function run(cwd: string, args: string[]): void {
  const result = spawnSync(process.execPath, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  if (result.status !== 0) {
    throw new Error(`${result.stdout}\n${result.stderr}`);
  }
}

it("replaces old data and resets counters without manual deletion", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "transit-cache-rebuild-"));
  const fixture = path.join(cwd, "gtfs");
  cpSync(path.join(projectRoot, "ci/gtfs"), fixture, { recursive: true });
  writeFileSync(
    path.join(cwd, "transit-config.json"),
    JSON.stringify({
      sqlitePath: "custom-cache/transit.db",
      agencies: [{ agency_key: "synthetic", path: "gtfs" }],
      verbose: false,
    }),
  );
  const queryScript = path.join(cwd, "query.mts");
  writeFileSync(queryScript, `
    import assert from "node:assert/strict";
    import { TransitManager } from ${JSON.stringify(path.join(projectRoot, "src/lib/db/transit-manager.ts"))};
    import { prisma } from ${JSON.stringify(path.join(projectRoot, "src/lib/db/prisma.ts"))};
    try {
      assert.equal(await prisma.rateLimit.count(), 0);
      await prisma.rateLimit.create({data: {ip: "127.0.0.1", count: 1, last_access: BigInt(123)}});
      assert.equal((await prisma.rateLimit.findUniqueOrThrow({where: {ip: "127.0.0.1"}})).last_access, BigInt(123));
      const manager = TransitManager.getInstance();
      assert.equal((await manager.getStops()).length, 2);
      const departures = await manager.getDepartures("000001", "0007", new Date("2026-07-06T06:00:00Z"));
      assert.equal(departures.length, 1);
      assert.equal(departures[0].scheduledTime, process.env.EXPECTED_TIME || "07:00:00");
      assert.ok((await manager.getValidServiceIds(new Date("2026-07-04T00:00:00Z"))).includes("サービス_日本語_01"));
      assert.ok(!(await manager.getValidServiceIds(new Date("2026-07-05T00:00:00Z"))).includes("サービス_日本語_01"));
    } finally {
      await prisma.$disconnect();
    }
  `);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      run(cwd, [tsxCli, "--tsconfig", path.join(projectRoot, "tsconfig.json"), path.join(projectRoot, "scripts/import-gtfs.ts")]);
      run(cwd, [tsxCli, "--tsconfig", path.join(projectRoot, "tsconfig.json"), queryScript]);
      const staleScript = path.join(cwd, "stale.mts");
      writeFileSync(staleScript, `
        import { prisma } from ${JSON.stringify(path.join(projectRoot, "src/lib/db/prisma.ts"))};
        await prisma.stop.create({data: {id: "stale-only", name: "Old stop", lat: 0, lon: 0}});
        await prisma.$disconnect();
      `);
      run(cwd, [tsxCli, "--tsconfig", path.join(projectRoot, "tsconfig.json"), staleScript]);
      const times = path.join(fixture, "stop_times.txt");
      writeFileSync(times, readFileSync(times, "utf8").replaceAll("07:00:00", "08:00:00"));
      writeFileSync(queryScript, readFileSync(queryScript, "utf8").replace('"07:00:00"', '"08:00:00"'));
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}, 60_000);
