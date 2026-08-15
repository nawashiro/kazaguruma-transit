import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildAccessibilityAuditPlan,
  buildLighthouseArgs,
  DEFAULT_A11Y_ROUTES,
  resolveAccessibilityEnvironment,
  routeToFileSlug,
  shouldFailAccessibilityAudit,
} from "../scripts/accessibility-audit-config";

type PackageJson = {
  scripts?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const repositoryRoot = path.resolve(__dirname, "..");

function readPackageJson(): PackageJson {
  return JSON.parse(
    readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  ) as PackageJson;
}

describe("Lighthouse accessibility tooling", () => {
  it("exposes local and CI audit commands", () => {
    const packageJson = readPackageJson();

    expect(packageJson.devDependencies).toEqual(
      expect.objectContaining({
        lighthouse: expect.any(String),
        "start-server-and-test": expect.any(String),
      }),
    );
    expect(packageJson.scripts).toEqual(
      expect.objectContaining({
        a11y: "npm run accessibility",
        accessibility: "tsx scripts/accessibility-audit.ts",
        "accessibility:strict": "tsx scripts/accessibility-audit.ts --strict",
        "accessibility:ci":
          "start-server-and-test dev http://127.0.0.1:3000 accessibility:strict",
      }),
    );
  });

  it("turns the strict CLI flag into an error-level audit assertion", () => {
    expect(
      resolveAccessibilityEnvironment(
        { LIGHTHOUSE_ASSERTION_LEVEL: "warn" },
        ["--strict"],
      ),
    ).toEqual({ LIGHTHOUSE_ASSERTION_LEVEL: "error" });
  });

  it("fails only strict audits when Lighthouse reports an accessibility violation", () => {
    const report = {
      categories: { accessibility: { score: 0.97 } },
      audits: { "color-contrast": { score: 0 } },
    };

    expect(shouldFailAccessibilityAudit(report, false)).toBe(false);
    expect(shouldFailAccessibilityAudit(report, true)).toBe(true);
  });

  it("audits accessibility and color contrast for the default pages", () => {
    const plan = buildAccessibilityAuditPlan({});

    expect(plan.urls).toEqual(
      DEFAULT_A11Y_ROUTES.map((route) => `http://127.0.0.1:3000${route}`),
    );
    expect(plan.outputDirectory).toBe("./artifacts/lighthouse");
    expect(plan.strict).toBe(false);

    expect(
      buildLighthouseArgs(
        plan.urls[0],
        "./artifacts/lighthouse/01-home",
        plan.chromeFlags,
      ),
    ).toEqual([
      "http://127.0.0.1:3000/",
      "--only-categories=accessibility",
      "--output=html",
      "--output=json",
      "--output-path=./artifacts/lighthouse/01-home",
      "--chrome-flags=--headless --disable-dev-shm-usage",
    ]);
    expect(routeToFileSlug("https://example.test/locations?category=care")).toBe(
      "locations-category-care",
    );
  });

  it("allows the audited origin, routes, flags, and strict mode to be overridden", () => {
    const plan = buildAccessibilityAuditPlan({
      LIGHTHOUSE_BASE_URL: "https://staging.example.test",
      LIGHTHOUSE_ROUTES: "/,/award",
      LIGHTHOUSE_OUTPUT_DIR: "./tmp/a11y",
      LIGHTHOUSE_CHROME_FLAGS: "--headless --no-sandbox",
      LIGHTHOUSE_ASSERTION_LEVEL: "error",
    });

    expect(plan).toEqual({
      urls: [
        "https://staging.example.test/",
        "https://staging.example.test/award",
      ],
      outputDirectory: "./tmp/a11y",
      strict: true,
      chromeFlags: "--headless --no-sandbox",
    });
  });
});
