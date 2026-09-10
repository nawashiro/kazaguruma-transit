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

  it("makes CI own the explicit example-to-config copy", () => {
    const workflow = readProjectFile(".github/workflows/quality-gate.yml");
    const prepareStep = readWorkflowStep(
      workflow,
      "Prepare public app configuration",
    );

    expect(prepareStep).toMatch(
      /^\s*cp\s+app-config\.json\.example\s+app-config\.json\s*$/mu,
    );
  });
});
