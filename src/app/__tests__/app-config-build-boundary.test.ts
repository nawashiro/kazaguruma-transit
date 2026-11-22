import { readFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "../../..");

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function readWorkflowStep(workflow: string, stepName: string): string {
  const marker = `- name: ${stepName}`;
  const start = workflow.indexOf(marker);
  if (start < 0) {
    throw new Error(`Workflow step not found: ${stepName}`);
  }

  const remaining = workflow.slice(start);
  const nextStep = remaining.search(/\n\s*-\s+name:/u);
  return remaining.slice(0, nextStep < 0 ? remaining.length : nextStep);
}

describe("app-config build and deployment boundary", () => {
  it("keeps npm lifecycle checks and Docker checks separate from example copying", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const lifecycleScripts = ["predev", "prebuild", "prestart", "pretest"];

    for (const scriptName of lifecycleScripts) {
      const script = packageJson.scripts[scriptName];
      expect(script).toContain("scripts/ensure-app-config.mjs");
      expect(script).not.toContain("app-config.json.example");
    }

    for (const dockerfile of ["Dockerfile.dev", "Dockerfile.prod"]) {
      const source = readProjectFile(dockerfile);
      expect(source).toContain("scripts/ensure-app-config.mjs");
      expect(source).not.toContain("app-config.json.example");
    }
  });

  it("makes the build generate its artifact from the production configuration unless one is pinned", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.prebuild).toContain(
      "APP_CONFIG_ENV=${APP_CONFIG_ENV:-production}",
    );
    expect(packageJson.scripts.prebuild).toContain(
      "scripts/generate-location-artifact.ts",
    );

    for (const scriptName of ["predev", "pretest"]) {
      expect(packageJson.scripts[scriptName]).not.toContain(
        "generate-location-artifact",
      );
    }
  });

  it("selects the local configuration inside the development image", () => {
    const developmentDockerfile = readProjectFile("Dockerfile.dev");
    const buildIndex = developmentDockerfile.indexOf("npm run build");

    expect(buildIndex).toBeGreaterThan(-1);
    expect(
      developmentDockerfile.slice(0, buildIndex),
    ).toContain("ENV APP_CONFIG_ENV=local");
    expect(readProjectFile("Dockerfile.prod")).not.toContain("APP_CONFIG_ENV");
  });

  it("makes CI own the explicit template-to-config copy", () => {
    const workflow = readProjectFile(".github/workflows/quality-gate.yml");
    const prepareStep = readWorkflowStep(
      workflow,
      "Prepare public app configuration",
    );

    expect(prepareStep).toMatch(
      /^\s*cp\s+app-config\.json\.example\s+app-config\.json\s*$/mu,
    );
    expect(prepareStep).toMatch(
      /^\s*cp\s+app-config\.json\.example\s+app-config\.local\.json\s*$/mu,
    );
  });
});
