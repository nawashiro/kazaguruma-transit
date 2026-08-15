import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildAccessibilityAuditPlan,
  buildLighthouseArgs,
  getFailedAccessibilityAudits,
  resolveAccessibilityEnvironment,
  routeToFileSlug,
  shouldFailAccessibilityAudit,
} from "./accessibility-audit-config";
import type { LighthouseAuditReport } from "./accessibility-audit-config";

function runLighthouse(args: string[]): Promise<number> {
  const command = process.platform === "win32" ? "lighthouse.cmd" : "lighthouse";

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });

    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
}

function formatScore(score: number | null | undefined): string {
  return typeof score === "number" ? score.toFixed(2) : "n/a";
}

async function loadReport(reportPath: string): Promise<LighthouseAuditReport> {
  const rawReport = await readFile(reportPath, "utf8");
  return JSON.parse(rawReport) as LighthouseAuditReport;
}

async function main(): Promise<void> {
  const plan = buildAccessibilityAuditPlan(resolveAccessibilityEnvironment());
  const outputDirectory = path.resolve(process.cwd(), plan.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });

  let hasFailure = false;

  for (const [index, url] of plan.urls.entries()) {
    const outputBasePath = path.join(
      outputDirectory,
      `${String(index + 1).padStart(2, "0")}-${routeToFileSlug(url)}`,
    );
    const args = buildLighthouseArgs(url, outputBasePath, plan.chromeFlags);

    console.log(`\nRunning Lighthouse accessibility audit: ${url}`);
    const exitCode = await runLighthouse(args);

    if (exitCode !== 0) {
      hasFailure = true;
      console.error(`Lighthouse failed for ${url} with exit code ${exitCode}`);
      continue;
    }

    const reportPath = `${outputBasePath}.report.json`;

    try {
      const report = await loadReport(reportPath);
      const accessibilityScore = report.categories?.accessibility?.score;
      const contrastScore = report.audits?.["color-contrast"]?.score;
      const failedAudits = getFailedAccessibilityAudits(report);

      console.log(
        `Scores: accessibility=${formatScore(accessibilityScore)}, ` +
          `color-contrast=${formatScore(contrastScore)}`,
      );
      console.log(`Reports: ${outputBasePath}.report.html and .report.json`);

      if (failedAudits.length > 0) {
        const marker = plan.strict ? "✗" : "⚠";
        console.warn(`${marker} Failed audits: ${failedAudits.join(", ")}`);
        hasFailure ||= shouldFailAccessibilityAudit(report, plan.strict);
      }
    } catch (error) {
      hasFailure = true;
      console.error(`Unable to read Lighthouse report for ${url}:`, error);
    }
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error("Accessibility audit failed:", error);
  process.exitCode = 1;
});
