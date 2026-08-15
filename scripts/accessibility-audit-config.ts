export const DEFAULT_A11Y_ROUTES = [
  "/",
  "/beginners-guide",
  "/locations",
  "/license",
  "/login",
] as const;

export interface AccessibilityAuditPlan {
  urls: string[];
  outputDirectory: string;
  strict: boolean;
  chromeFlags: string;
}

export interface LighthouseAuditReport {
  categories?: {
    accessibility?: {
      score?: number | null;
    };
  };
  audits?: {
    "color-contrast"?: {
      score?: number | null;
    };
  };
}

export type AccessibilityEnvironment = Record<string, string | undefined>;

export function resolveAccessibilityEnvironment(
  environment: AccessibilityEnvironment = process.env,
  args: readonly string[] = process.argv.slice(2),
): AccessibilityEnvironment {
  if (!args.includes("--strict")) {
    return environment;
  }

  return {
    ...environment,
    LIGHTHOUSE_ASSERTION_LEVEL: "error",
  };
}

export function getFailedAccessibilityAudits(
  report: LighthouseAuditReport,
): string[] {
  const failedAudits: string[] = [];
  const accessibilityScore = report.categories?.accessibility?.score;
  const contrastScore = report.audits?.["color-contrast"]?.score;

  if (typeof accessibilityScore === "number" && accessibilityScore < 1) {
    failedAudits.push("accessibility");
  }

  if (typeof contrastScore === "number" && contrastScore < 1) {
    failedAudits.push("color-contrast");
  }

  return failedAudits;
}

export function shouldFailAccessibilityAudit(
  report: LighthouseAuditReport,
  strict: boolean,
): boolean {
  return strict && getFailedAccessibilityAudits(report).length > 0;
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported Lighthouse base URL protocol: ${url.protocol}`);
  }

  return url.toString().replace(/\/$/, "");
}

function resolveAuditUrl(baseUrl: string, route: string): string {
  if (/^https?:\/\//.test(route)) {
    return route;
  }

  return `${baseUrl}/${route.replace(/^\/+/, "")}`;
}

export function buildAccessibilityAuditPlan(
  environment: AccessibilityEnvironment = process.env,
): AccessibilityAuditPlan {
  const baseUrl = normalizeBaseUrl(
    environment.LIGHTHOUSE_BASE_URL || "http://127.0.0.1:3000",
  );
  const configuredRoutes = (environment.LIGHTHOUSE_ROUTES || "")
    .split(",")
    .map((route) => route.trim())
    .filter(Boolean);
  const routes =
    configuredRoutes.length > 0 ? configuredRoutes : DEFAULT_A11Y_ROUTES;

  return {
    urls: routes.map((route) => resolveAuditUrl(baseUrl, route)),
    outputDirectory:
      environment.LIGHTHOUSE_OUTPUT_DIR || "./artifacts/lighthouse",
    strict: environment.LIGHTHOUSE_ASSERTION_LEVEL === "error",
    chromeFlags:
      environment.LIGHTHOUSE_CHROME_FLAGS ||
      "--headless --disable-dev-shm-usage",
  };
}

export function routeToFileSlug(url: string): string {
  const parsedUrl = new URL(url);
  const route = `${parsedUrl.pathname}${parsedUrl.search}`
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return route || "home";
}

export function buildLighthouseArgs(
  url: string,
  outputBasePath: string,
  chromeFlags: string,
): string[] {
  return [
    url,
    "--only-categories=accessibility",
    "--output=html",
    "--output=json",
    `--output-path=${outputBasePath}`,
    `--chrome-flags=${chromeFlags}`,
  ];
}
