import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

type WorkflowStep = {
  run?: unknown;
  "working-directory"?: unknown;
};

type WorkflowJob = {
  id: string;
  defaults?: unknown;
  steps: WorkflowStep[];
};

type WorkflowDocument = {
  defaults?: unknown;
  jobs: WorkflowJob[];
};

type YamlModule = {
  load: (source: string) => unknown;
};

type WorkingDirectorySetting = {
  defined: boolean;
  value: unknown;
};

const repositoryRoot = process.cwd();
const workflowPath = path.resolve(
  repositoryRoot,
  ".github/workflows/quality-gate.yml",
);
const requireFromRepository = createRequire(
  path.resolve(repositoryRoot, "package.json"),
);
const yaml = requireFromRepository("js-yaml") as YamlModule;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function parseWorkflow(): WorkflowDocument {
  const parsed = yaml.load(fs.readFileSync(workflowPath, "utf8"));

  if (!isRecord(parsed) || !isRecord(parsed.jobs)) {
    throw new Error("quality-gate.yml must define a jobs mapping");
  }

  const jobs = Object.entries(parsed.jobs).map(([id, rawJob]) => {
    if (!isRecord(rawJob) || !Array.isArray(rawJob.steps)) {
      throw new Error(`Workflow job ${id} must define a steps sequence`);
    }

    const steps = rawJob.steps.map((rawStep, index) => {
      if (!isRecord(rawStep)) {
        throw new Error(`Workflow job ${id} step ${index} must be a mapping`);
      }
      return rawStep as WorkflowStep;
    });

    return {
      id,
      defaults: rawJob.defaults,
      steps,
    };
  });

  return { defaults: parsed.defaults, jobs };
}

function runLines(step: WorkflowStep): string[] {
  if (typeof step.run !== "string") {
    return [];
  }

  return step.run
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function hasCommand(step: WorkflowStep, pattern: RegExp): boolean {
  return runLines(step).some((line) => {
    pattern.lastIndex = 0;
    return pattern.test(line);
  });
}

function isLintStep(step: WorkflowStep): boolean {
  return hasCommand(step, /^npm\s+run\s+lint(?:\s|$)/);
}

function isTypeCheckStep(step: WorkflowStep): boolean {
  return hasCommand(
    step,
    /^(?:(?:npx|npm\s+exec)\s+)?tsc\b.*--noEmit\b|^npm\s+run\s+(?:typecheck|type-check|check:types)(?:\s|$)/,
  );
}

function isBuildStep(step: WorkflowStep): boolean {
  return hasCommand(step, /^npm\s+run\s+build(?:\s|$)/);
}

function shellWords(command: string): string[] | null {
  const words: string[] = [];
  let word = "";
  let wordStarted = false;
  let quote: "'" | '"' | null = null;

  const pushWord = (): void => {
    if (wordStarted) {
      words.push(word);
      word = "";
      wordStarted = false;
    }
  };

  for (const character of command) {
    if (quote !== null) {
      if (character === quote) {
        quote = null;
      } else if (character === "\\") {
        return null;
      } else {
        word += character;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      wordStarted = true;
      continue;
    }

    if (/\s/.test(character)) {
      pushWord();
      continue;
    }

    if (character === "#" && !wordStarted) {
      break;
    }

    if ([";", "&", "|", "<", ">", "`", "$", "\\"].includes(character)) {
      return null;
    }

    word += character;
    wordStarted = true;
  }

  if (quote !== null) {
    return null;
  }

  pushWord();
  return words;
}

function isExactRootRelativePath(value: string, expected: string): boolean {
  return value === expected || value === `./${expected}`;
}

function isTransitConfigPlacementCommand(command: string): boolean {
  const words = shellWords(command);
  if (words === null || words.length < 1) {
    return false;
  }

  const [executable, ...rawArguments] = words;
  if (executable !== "cp" && executable !== "install" && executable !== "mv") {
    return false;
  }

  const argumentsWithoutEndOfOptions =
    rawArguments[0] === "--" ? rawArguments.slice(1) : rawArguments;
  if (argumentsWithoutEndOfOptions.length !== 2) {
    return false;
  }

  const [source, destination] = argumentsWithoutEndOfOptions;
  return (
    isExactRootRelativePath(source, "ci/transit-config.json") &&
    isExactRootRelativePath(destination, "transit-config.json")
  );
}

function isTransitConfigPlacementStep(step: WorkflowStep): boolean {
  return runLines(step).some(isTransitConfigPlacementCommand);
}

function missingWorkingDirectorySetting(): WorkingDirectorySetting {
  return { defined: false, value: undefined };
}

function readDefaultWorkingDirectory(
  defaults: unknown,
): WorkingDirectorySetting {
  if (!isRecord(defaults) || !hasOwn(defaults, "run")) {
    return missingWorkingDirectorySetting();
  }

  if (!isRecord(defaults.run)) {
    return { defined: true, value: undefined };
  }

  if (!hasOwn(defaults.run, "working-directory")) {
    return missingWorkingDirectorySetting();
  }

  return { defined: true, value: defaults.run["working-directory"] };
}

function effectiveWorkingDirectory(
  workflow: WorkflowDocument,
  job: WorkflowJob,
  step: WorkflowStep,
): WorkingDirectorySetting {
  if (hasOwn(step, "working-directory")) {
    return { defined: true, value: step["working-directory"] };
  }

  const jobSetting = readDefaultWorkingDirectory(job.defaults);
  if (jobSetting.defined) {
    return jobSetting;
  }

  const workflowSetting = readDefaultWorkingDirectory(workflow.defaults);
  if (workflowSetting.defined) {
    return workflowSetting;
  }

  return missingWorkingDirectorySetting();
}

function isExplicitRepositoryRootWorkingDirectory(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  if (value === "." || value === "./") {
    return true;
  }

  if (/^\$\{\{\s*github\.workspace\s*\}\}(?:\/\.?)?$/.test(value)) {
    return true;
  }

  return [
    "$GITHUB_WORKSPACE",
    "$GITHUB_WORKSPACE/",
    "${GITHUB_WORKSPACE}",
    "${GITHUB_WORKSPACE}/",
  ].includes(value);
}

function isRepositoryRootWorkingDirectory(
  workflow: WorkflowDocument,
  job: WorkflowJob,
  step: WorkflowStep,
): boolean {
  const setting = effectiveWorkingDirectory(workflow, job, step);
  return (
    !setting.defined || isExplicitRepositoryRootWorkingDirectory(setting.value)
  );
}

function isRootTransitConfigPlacementStep(
  workflow: WorkflowDocument,
  job: WorkflowJob,
  step: WorkflowStep,
): boolean {
  return (
    isTransitConfigPlacementStep(step) &&
    isRepositoryRootWorkingDirectory(workflow, job, step)
  );
}

const workflow = parseWorkflow();
const buildJobs = workflow.jobs.filter((job) =>
  job.steps.some(isBuildStep),
);

function buildJob(): WorkflowJob {
  expect(buildJobs).toHaveLength(1);
  const job = buildJobs[0];
  if (job === undefined) {
    throw new Error("quality-gate.yml must contain a build job");
  }
  return job;
}

function indexOfStep(
  steps: WorkflowStep[],
  predicate: (step: WorkflowStep) => boolean,
): number {
  return steps.findIndex(predicate);
}

describe("Quality Gateのtransit-config配置判定", () => {
  it("安全な空白と単純なquoteを許容する", () => {
    expect(
      isTransitConfigPlacementCommand(
        'cp "ci/transit-config.json" "transit-config.json"',
      ),
    ).toBe(true);
    expect(
      isTransitConfigPlacementCommand(
        "  cp   'ci/transit-config.json'   './transit-config.json' # comment",
      ),
    ).toBe(true);
  });

  it("source・destinationの曖昧なpathやshell構文を許容しない", () => {
    const invalidCommands = [
      "cp ../ci/transit-config.json transit-config.json",
      "cp packages/ci/transit-config.json transit-config.json",
      "cp xci/transit-config.json transit-config.json",
      "cp ci/transit-config.json transit-config.json.bak",
      "cp ci/transit-config.json transit-config.json && echo unsafe",
      'cp "ci/transit-config.json transit-config.json',
    ];

    for (const command of invalidCommands) {
      expect(isTransitConfigPlacementCommand(command)).toBe(false);
    }
  });

  it("workflow・job・stepのworking-directory継承を解決してrootだけを許容する", () => {
    const workflowWithSubdirectoryDefault: WorkflowDocument = {
      defaults: { run: { "working-directory": "packages" } },
      jobs: [],
    };
    const jobWithoutDefault: WorkflowJob = {
      id: "job",
      steps: [],
    };
    const placementStep: WorkflowStep = {
      run: 'cp "ci/transit-config.json" "transit-config.json"',
    };

    expect(
      isRepositoryRootWorkingDirectory(
        workflowWithSubdirectoryDefault,
        jobWithoutDefault,
        placementStep,
      ),
    ).toBe(false);

    const jobWithRootDefault: WorkflowJob = {
      id: "job",
      defaults: { run: { "working-directory": "./" } },
      steps: [],
    };
    expect(
      isRootTransitConfigPlacementStep(
        workflowWithSubdirectoryDefault,
        jobWithRootDefault,
        placementStep,
      ),
    ).toBe(true);

    const stepWithSubdirectory: WorkflowStep = {
      ...placementStep,
      "working-directory": "packages",
    };
    expect(
      isRootTransitConfigPlacementStep(
        workflowWithSubdirectoryDefault,
        jobWithRootDefault,
        stepWithSubdirectory,
      ),
    ).toBe(false);

    const stepWithWorkspaceExpression: WorkflowStep = {
      ...placementStep,
      "working-directory": "${{ github.workspace }}/",
    };
    expect(
      isRootTransitConfigPlacementStep(
        workflowWithSubdirectoryDefault,
        jobWithoutDefault,
        stepWithWorkspaceExpression,
      ),
    ).toBe(true);
  });
});

describe("Quality Gateのtransit-config配置順契約", () => {
  it("buildとlint・型検査・root配置を同一job内で実行する", () => {
    const job = buildJob();
    const steps = job.steps;

    expect(indexOfStep(steps, isLintStep)).toBeGreaterThanOrEqual(0);
    expect(indexOfStep(steps, isTypeCheckStep)).toBeGreaterThanOrEqual(0);
    expect(
      indexOfStep(steps, (step) =>
        isRootTransitConfigPlacementStep(workflow, job, step),
      ),
    ).toBeGreaterThanOrEqual(0);
    expect(indexOfStep(steps, isBuildStep)).toBeGreaterThanOrEqual(0);
  });

  it("lintと型検査の後に合成transit-configをrootへ配置する", () => {
    const job = buildJob();
    const steps = job.steps;
    const lintIndex = indexOfStep(steps, isLintStep);
    const typeCheckIndex = indexOfStep(steps, isTypeCheckStep);
    const placementIndex = indexOfStep(steps, (step) =>
      isRootTransitConfigPlacementStep(workflow, job, step),
    );

    expect(lintIndex).toBeLessThan(typeCheckIndex);
    expect(typeCheckIndex).toBeLessThan(placementIndex);
  });

  it("root配置の直後にnpm run buildを実行する", () => {
    const job = buildJob();
    const steps = job.steps;
    const placementIndex = indexOfStep(steps, (step) =>
      isRootTransitConfigPlacementStep(workflow, job, step),
    );
    const buildIndex = indexOfStep(steps, isBuildStep);

    expect(placementIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBe(placementIndex + 1);
  });

  it("配置stepとbuild stepの実行ディレクトリはrepository rootである", () => {
    const job = buildJob();
    const steps = job.steps;
    const placementCommandIndex = indexOfStep(
      steps,
      isTransitConfigPlacementStep,
    );
    const buildIndex = indexOfStep(steps, isBuildStep);

    expect(placementCommandIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThanOrEqual(0);
    expect(
      isRepositoryRootWorkingDirectory(
        workflow,
        job,
        steps[placementCommandIndex] ?? {},
      ),
    ).toBe(true);
    expect(
      isRepositoryRootWorkingDirectory(workflow, job, steps[buildIndex] ?? {}),
    ).toBe(true);
  });
});
