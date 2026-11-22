/** @jest-environment node */

import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isProductionBuildUsable } from "../production-build";

const createdRoots: string[] = [];

function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, JSON.stringify(value));
}

function createBuild(): string {
  const root = mkdtempSync(join(tmpdir(), "production-build-"));
  createdRoots.push(root);
  const nextDir = join(root, ".next");
  mkdirSync(join(nextDir, "server"), { recursive: true });
  writeFileSync(join(nextDir, "BUILD_ID"), "test-build-id");
  writeJson(join(nextDir, "routes-manifest.json"), {
    dataRoutes: [],
    dynamicRoutes: [],
  });
  writeJson(join(nextDir, "prerender-manifest.json"), { routes: {} });
  writeJson(join(nextDir, "server", "pages-manifest.json"), {});
  return nextDir;
}

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("isProductionBuildUsable", () => {
  it("reuses a build that has every manifest next start reads", () => {
    expect(isProductionBuildUsable(createBuild())).toBe(true);
  });

  it("rejects a build without BUILD_ID", () => {
    const nextDir = createBuild();
    rmSync(join(nextDir, "BUILD_ID"));

    expect(isProductionBuildUsable(nextDir)).toBe(false);
  });

  it("rejects a build with an empty BUILD_ID", () => {
    const nextDir = createBuild();
    writeFileSync(join(nextDir, "BUILD_ID"), "  \n");

    expect(isProductionBuildUsable(nextDir)).toBe(false);
  });

  it("rejects a routes manifest without dataRoutes", () => {
    const nextDir = createBuild();
    writeJson(join(nextDir, "routes-manifest.json"), { dynamicRoutes: [] });

    expect(isProductionBuildUsable(nextDir)).toBe(false);
  });

  it("rejects a routes manifest whose dynamicRoutes is not an array", () => {
    const nextDir = createBuild();
    writeJson(join(nextDir, "routes-manifest.json"), {
      dataRoutes: [],
      dynamicRoutes: {},
    });

    expect(isProductionBuildUsable(nextDir)).toBe(false);
  });

  it("rejects an unparsable routes manifest", () => {
    const nextDir = createBuild();
    writeFileSync(join(nextDir, "routes-manifest.json"), "{\"dataRoutes\":");

    expect(isProductionBuildUsable(nextDir)).toBe(false);
  });

  it("rejects a prerender manifest without routes", () => {
    const nextDir = createBuild();
    writeJson(join(nextDir, "prerender-manifest.json"), { version: 4 });

    expect(isProductionBuildUsable(nextDir)).toBe(false);
  });

  it("rejects a build without the pages manifest", () => {
    const nextDir = createBuild();
    rmSync(join(nextDir, "server", "pages-manifest.json"));

    expect(isProductionBuildUsable(nextDir)).toBe(false);
  });

  it("rejects a directory that is not a build", () => {
    const root = mkdtempSync(join(tmpdir(), "production-build-"));
    createdRoots.push(root);

    expect(isProductionBuildUsable(join(root, ".next"))).toBe(false);
  });
});
