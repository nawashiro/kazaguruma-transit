import { readFile } from "fs/promises";
import path from "path";
import { OpenDataLicenseEntry } from "@/types/license";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseOpenDataLicenses(raw: unknown): OpenDataLicenseEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const ids = new Set<string>();

  return raw
    .map((entry, index) => {
      const record = (entry ?? {}) as Record<string, unknown>;
      const id = asString(record.id) ?? `open-data-${index + 1}`;
      if (ids.has(id)) {
        throw new Error(`Duplicate open data id: ${id}`);
      }
      ids.add(id);

      const name = asString(record.name);
      const licenseName = asString(record.licenseName);
      if (!name || !licenseName) {
        throw new Error(`Invalid open data entry at index ${index}`);
      }

      return {
        id,
        name,
        provider: asString(record.provider),
        licenseName,
        licenseUrl: asString(record.licenseUrl),
        sourceUrl: asString(record.sourceUrl),
        description: asString(record.description),
      } satisfies OpenDataLicenseEntry;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));
}

export async function loadOpenDataLicenses(
  filePath = path.join(process.cwd(), "src/lib/license/openDataLicenses.json")
): Promise<OpenDataLicenseEntry[]> {
  const raw = await readFile(filePath, "utf8");
  return parseOpenDataLicenses(JSON.parse(raw));
}
