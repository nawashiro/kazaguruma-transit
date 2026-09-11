import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  version?: string;
}

function readPackageManifest(packagePath: string): PackageManifest {
  return JSON.parse(readFileSync(packagePath, "utf8")) as PackageManifest;
}

function readInstalledPackageVersion(packageName: string): string {
  let packageJsonPath: string;

  try {
    packageJsonPath = require.resolve(`${packageName}/package.json`);
  } catch {
    packageJsonPath = join(
      dirname(require.resolve(packageName)),
      "..",
      "package.json"
    );
  }

  expect(existsSync(packageJsonPath)).toBe(true);
  return readPackageManifest(packageJsonPath).version ?? "0.0.0";
}

function getDeclaredMinimumVersion(range: string | undefined): string {
  return range?.replace(/^[~^]/, "") ?? "0.0.0";
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

  it("declares patched versions for externally reachable server dependencies", () => {
    const packageJson = readPackageManifest(join(__dirname, "..", "package.json"));

    expect(
      isVersionAtLeast(
        getDeclaredMinimumVersion(packageJson.dependencies?.next),
        "15.5.21"
      )
    ).toBe(true);
    expect(
      isVersionAtLeast(
        getDeclaredMinimumVersion(packageJson.dependencies?.puppeteer),
        "25.10.0"
      )
    ).toBe(true);
    expect(packageJson.dependencies).not.toHaveProperty(
      "transit-departures-widget"
    );
    expect(packageJson.devDependencies).not.toHaveProperty("@types/puppeteer");
  });

  it("resolves patched versions for externally reachable server dependencies", () => {
    expect(isVersionAtLeast(readInstalledPackageVersion("next"), "15.5.21")).toBe(
      true
    );
    expect(
      isVersionAtLeast(readInstalledPackageVersion("puppeteer"), "25.10.0")
    ).toBe(true);
  });

  it("resolves Next.js dependencies to patched versions", () => {
    const nextPackageDirectory = dirname(require.resolve("next/package.json"));
    const postcssPackagePath = require.resolve("postcss/package.json", {
      paths: [nextPackageDirectory],
    });
    const postcssVersion = readPackageManifest(postcssPackagePath).version;

    expect(postcssVersion).toBeDefined();
    expect(isVersionAtLeast(postcssVersion ?? "0.0.0", "8.5.23")).toBe(true);
    expect(isVersionAtLeast(readInstalledPackageVersion("sharp"), "0.35.0")).toBe(
      true
    );
    expect(
      isVersionAtLeast(readInstalledPackageVersion("nanoid"), "3.3.18")
    ).toBe(true);
  });
});
