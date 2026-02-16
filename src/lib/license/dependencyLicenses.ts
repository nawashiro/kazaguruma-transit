import { readFile } from "fs/promises";
import path from "path";
import { DependencyLicenseEntry } from "@/types/license";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeLicense(value: unknown): string {
  return text(value) ?? "UNKNOWN";
}

function fromRecord(packageName: string, value: unknown): DependencyLicenseEntry {
  const record = (value ?? {}) as Record<string, unknown>;
  return {
    packageName,
    version: text(record.version) ?? "unknown",
    license: normalizeLicense(record.license ?? record.licenses),
    author: text(record.author),
    repository: text(record.repository),
    homepage: text(record.homepage),
  };
}

function fromPluginRow(value: unknown): DependencyLicenseEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const packageName = text(record.name);
  if (!packageName) {
    return null;
  }

  return {
    packageName,
    version: text(record.version) ?? "unknown",
    license: normalizeLicense(record.license),
    author: text(record.author),
    repository: text(record.repository),
    homepage: text(record.homepage),
  };
}

export function parseDependencyLicenses(raw: unknown): DependencyLicenseEntry[] {
  if (Array.isArray(raw)) {
    return raw
      .map((value) => fromPluginRow(value))
      .filter((value): value is DependencyLicenseEntry => value !== null)
      .sort((a, b) => a.packageName.localeCompare(b.packageName));
  }

  if (!raw || typeof raw !== "object") {
    return [];
  }

  const report = raw as Record<string, unknown>;
  const container =
    (report.dependencies as Record<string, unknown> | undefined) ??
    (report.packages as Record<string, unknown> | undefined) ??
    report;

  return Object.entries(container)
    .filter(([key, value]) => key !== "generatedAt" && value && typeof value === "object")
    .map(([packageName, value]) => fromRecord(packageName, value))
    .sort((a, b) => a.packageName.localeCompare(b.packageName));
}

export async function loadDependencyLicenses(
  filePath:
    | string
    | string[] = [
    path.join(process.cwd(), ".next/server/public/licenses/dependencies.json"),
    path.join(process.cwd(), ".next/public/licenses/dependencies.json"),
    path.join(process.cwd(), "public/licenses/dependencies.json"),
  ]
): Promise<DependencyLicenseEntry[]> {
  const candidates = Array.isArray(filePath) ? filePath : [filePath];

  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, "utf8");
      return parseDependencyLicenses(JSON.parse(raw));
    } catch {
      // try next candidate
    }
  }

  return [];
}
