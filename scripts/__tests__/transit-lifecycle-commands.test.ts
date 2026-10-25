/** @jest-environment node */

import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../..");
const scripts = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")).scripts;

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for lifecycle event");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

it.each(["dev", "start"])("%s waits for rebuild and refuses to serve after failure", async (command) => {
  const cwd = mkdtempSync(path.join(tmpdir(), "transit-command-"));
  const bin = path.join(cwd, "node_modules/.bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(path.join(cwd, "package.json"), JSON.stringify({scripts: { [command]: scripts[command], "import-gtfs": scripts["import-gtfs"] }}));
  const events = path.join(cwd, "events");
  const release = path.join(cwd, "release");
  for (const name of ["prisma", "tsx", "next"]) {
    const filename = path.join(bin, name);
    writeFileSync(filename, `#!${process.execPath}\n
      const fs = require('node:fs');
      const args = process.argv.slice(2);
      const event = ${JSON.stringify(name)} + ':' + args.join(' ');
      fs.appendFileSync(${JSON.stringify(events)}, event + '\\n');
      if (${JSON.stringify(name)} === 'tsx') {
        if (args[0] !== 'scripts/import-gtfs.ts') process.exit(9);
        const timer = setInterval(() => {
          if (fs.existsSync(${JSON.stringify(release)})) {
            clearInterval(timer);
            const status = Number(fs.readFileSync(${JSON.stringify(release)}, 'utf8'));
            fs.appendFileSync(${JSON.stringify(events)}, 'rebuild:' + status + '\\n');
            process.exit(status);
          }
        }, 20);
      }
    `);
    chmodSync(filename, 0o755);
  }
  try {
    for (const status of [0, 1]) {
      rmSync(events, { force: true });
      rmSync(release, { force: true });
      const child = spawn("npm", ["run", command], {cwd, stdio: "pipe"});
      const output: string[] = [];
      child.stdout.on("data", (data) => output.push(String(data)));
      child.stderr.on("data", (data) => output.push(String(data)));
      const completion = new Promise<number | null>((resolve) => child.on("close", resolve));
      try {
        await waitFor(() => existsSync(events) && readFileSync(events, "utf8").includes("tsx:scripts/import-gtfs.ts"));
        expect(readFileSync(events, "utf8")).not.toContain("next:");
        writeFileSync(release, String(status));
        const exitStatus = await completion;
        const recorded = readFileSync(events, "utf8");
        if (status === 0) {
          expect({exitStatus, output: output.join("")}).toEqual({exitStatus: 0, output: expect.any(String)});
          expect(recorded.indexOf("next:")).toBeGreaterThan(recorded.indexOf("rebuild:0"));
        } else {
          expect(exitStatus).not.toBe(0);
          expect(recorded).not.toContain("next:");
        }
      } finally {
        child.kill();
      }
    }
  } finally {
    rmSync(cwd, {recursive: true, force: true});
  }
}, 30_000);

it("build does not invoke GTFS or modify the runtime database", async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "transit-build-"));
  const bin = path.join(cwd, "node_modules/.bin");
  mkdirSync(bin, {recursive: true});
  const db = path.join(cwd, "runtime.db");
  const original = "runtime timetable and rate counters";
  writeFileSync(db, original);
  writeFileSync(path.join(cwd, "package.json"), JSON.stringify({scripts: {build: scripts.build, "import-gtfs": scripts["import-gtfs"]}}));
  for (const name of ["prisma", "next", "tsx"]) {
    const filename = path.join(bin, name);
    writeFileSync(filename, `#!${process.execPath}\nprocess.exit(${name === "tsx" ? 23 : 0});`);
    chmodSync(filename, 0o755);
  }
  try {
    const child = spawn("npm", ["run", "build"], {cwd, stdio: "ignore"});
    const status = await new Promise((resolve) => child.on("close", resolve));
    expect(status).toBe(0);
    expect(readFileSync(db, "utf8")).toBe(original);
  } finally {
    rmSync(cwd, {recursive: true, force: true});
  }
});
