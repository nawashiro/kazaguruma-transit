import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(projectRoot, "src");
const publicBoundaryFiles = [
  "AGENTS.md",
  "Dockerfile.dev",
  "Dockerfile.prod",
  "compose.yml",
  "compose.prod.yml",
  ".env.local.example",
  "README.md",
  "docs/manual/analytics.md",
  "app-config.json.example",
  ".github/workflows/quality-gate.yml",
  "scripts/ensure-app-config.mjs",
];

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return collectSourceFiles(entryPath);
    }
    if (!entry.isFile() || !/\.(?:ts|tsx|js|jsx|mjs)$/u.test(entry.name)) {
      return [];
    }
    if (/(?:\.test|\.spec)\.(?:ts|tsx|js|jsx|mjs)$/u.test(entry.name)) {
      return [];
    }
    return [entryPath];
  });
}

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("Issue #87 public configuration boundary", () => {
  it("does not read NEXT_PUBLIC environment variables in active source or setup files", () => {
    const paths = [
      ...collectSourceFiles(sourceRoot),
      ...publicBoundaryFiles.map((relativePath) => path.join(projectRoot, relativePath)),
    ];
    const violations = paths.flatMap((filePath) => {
      const source = readFileSync(filePath, "utf8");
      return source.includes("NEXT_PUBLIC_") ? [path.relative(projectRoot, filePath)] : [];
    });

    expect(violations).toEqual([]);
  });

  it("does not inject public values through Docker args or generated env files", () => {
    const violations = ["Dockerfile.dev", "Dockerfile.prod", "compose.yml", "compose.prod.yml"].flatMap(
      (relativePath) => {
        const source = readProjectFile(relativePath);
        const hasPublicArg = /(?:ARG|build:\s*\n[\s\S]*?args:)[\s\S]*NEXT_PUBLIC_/u.test(source);
        const hasGeneratedEnv = /RUN\s+echo[\s\S]*>>\s*\.env/u.test(source);
        return hasPublicArg || hasGeneratedEnv ? [relativePath] : [];
      },
    );

    expect(violations).toEqual([]);
  });

  it("keeps server-only secrets out of the public configuration template", () => {
    const rawConfig = readProjectFile("app-config.json.example").toLowerCase();
    const forbiddenKeys = [
      "transit",
      "google_maps_api_key",
      "googlemapsapikey",
      "cloudflare",
      "puppeteer",
    ];

    expect(forbiddenKeys.filter((key) => rawConfig.includes(key))).toEqual([]);
  });

  it("tracks the public template and ignores deployment-specific overrides", () => {
    expect(existsSync(path.join(projectRoot, "app-config.json.example"))).toBe(true);
    expect(readProjectFile(".gitignore")).toMatch(/^app-config\.json$/mu);
  });
});
