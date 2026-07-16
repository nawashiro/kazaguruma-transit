import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

interface PackageManifest {
  dependencies?: Record<string, string>;
  version?: string;
}

function readPackageManifest(packagePath: string): PackageManifest {
  return JSON.parse(readFileSync(packagePath, "utf8")) as PackageManifest;
}

function isVersionAtLeast(version: string, minimumVersion: string): boolean {
  const versionParts = version.split(".").map(Number);
  const minimumVersionParts = minimumVersion.split(".").map(Number);

  for (let index = 0; index < minimumVersionParts.length; index += 1) {
    const difference = versionParts[index] - minimumVersionParts[index];

    if (difference !== 0) {
      return difference > 0;
    }
  }

  return true;
}

describe("dependency security", () => {
  it("does not declare the unused vulnerable PDF and session packages", () => {
    const packageJson = readPackageManifest(join(__dirname, "..", "package.json"));

    expect(packageJson.dependencies).not.toHaveProperty("jspdf");
    expect(packageJson.dependencies).not.toHaveProperty("next-iron-session");
  });

  it("resolves Next.js PostCSS to a patched version", () => {
    const nextPackageDirectory = dirname(require.resolve("next/package.json"));
    const postcssPackagePath = require.resolve("postcss/package.json", {
      paths: [nextPackageDirectory],
    });
    const postcssVersion = readPackageManifest(postcssPackagePath).version;

    expect(postcssVersion).toBeDefined();
    expect(isVersionAtLeast(postcssVersion ?? "0.0.0", "8.5.10")).toBe(true);
  });
});
