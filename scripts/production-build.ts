import { readFileSync } from "node:fs";
import path from "node:path";

function readText(filePath: string): string | undefined {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function readJson(filePath: string): unknown {
  const text = readText(filePath);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isProductionBuildUsable(nextDir: string): boolean {
  const buildId = readText(path.join(nextDir, "BUILD_ID"));
  if (buildId === undefined || buildId.trim() === "") return false;

  const routesManifest = readJson(path.join(nextDir, "routes-manifest.json"));
  if (!isRecord(routesManifest)) return false;
  if (!Array.isArray(routesManifest.dataRoutes)) return false;
  if (!Array.isArray(routesManifest.dynamicRoutes)) return false;

  const prerenderManifest = readJson(
    path.join(nextDir, "prerender-manifest.json"),
  );
  if (!isRecord(prerenderManifest)) return false;
  if (!isRecord(prerenderManifest.routes)) return false;

  return isRecord(
    readJson(path.join(nextDir, "server", "pages-manifest.json")),
  );
}
