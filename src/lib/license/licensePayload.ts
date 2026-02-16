import { LicensePagePayload } from "@/types/license";
import { loadDependencyLicenses } from "@/lib/license/dependencyLicenses";
import { loadOpenDataLicenses } from "@/lib/license/openDataLicenses";
import { loadProjectMetadata } from "@/lib/license/projectMetadata";

export async function getLicensePagePayload(): Promise<LicensePagePayload> {
  const [software, openData, dependencies] = await Promise.all([
    loadProjectMetadata(),
    loadOpenDataLicenses(),
    loadDependencyLicenses(),
  ]);

  return {
    software,
    openData,
    dependencies: dependencies.map((entry) => ({
      ...entry,
      license: entry.license || "UNKNOWN",
    })),
    generatedAt: new Date().toISOString(),
  };
}
