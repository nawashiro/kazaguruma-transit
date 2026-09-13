import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

type Mapping = Record<string, unknown>;

type WorkflowStep = Mapping;

type WorkflowJob = {
  id: string;
  defaults: unknown;
  steps: WorkflowStep[];
};

type WorkflowDocument = {
  defaults: unknown;
  jobs: WorkflowJob[];
};

type YamlModule = {
  load: (source: string) => unknown;
};

type TransitConfig = {
  sqlitePath: string;
  agencies: Array<{ path: string }>;
};

const repositoryRoot = process.cwd();
const workflowPath = path.resolve(
  repositoryRoot,
  ".github/workflows/quality-gate.yml",
);
const transitConfigPath = path.resolve(
  repositoryRoot,
  "ci/transit-config.json",
);
const requireFromRepository = createRequire(
  path.resolve(repositoryRoot, "package.json"),
);
const yaml = requireFromRepository("js-yaml") as YamlModule;

function isMapping(value: unknown): value is Mapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Mapping, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function parseWorkflow(): WorkflowDocument {
  const parsed = yaml.load(fs.readFileSync(workflowPath, "utf8"));

  if (!isMapping(parsed) || !isMapping(parsed.jobs)) {
    throw new Error("quality-gate.yml must define a jobs mapping");
  }

  const jobs = Object.entries(parsed.jobs).map(([id, rawJob]) => {
    if (!isMapping(rawJob) || !Array.isArray(rawJob.steps)) {
      throw new Error(`Workflow job ${id} must define a steps sequence`);
    }

    const steps = rawJob.steps.map((rawStep, index) => {
      if (!isMapping(rawStep)) {
        throw new Error(`Workflow job ${id} step ${index} must be a mapping`);
      }
      return rawStep;
    });

    return {
      id,
      defaults: rawJob.defaults,
      steps,
    };
  });

  return {
    defaults: parsed.defaults,
    jobs,
  };
}

function parseTransitConfig(): TransitConfig {
  const parsed: unknown = JSON.parse(
    fs.readFileSync(transitConfigPath, "utf8"),
  );

  if (!isMapping(parsed) || typeof parsed.sqlitePath !== "string") {
    throw new Error("ci/transit-config.json must define a sqlitePath");
  }
  if (!Array.isArray(parsed.agencies)) {
    throw new Error("ci/transit-config.json must define an agencies array");
  }

  const agencies = parsed.agencies.map((rawAgency, index) => {
    if (!isMapping(rawAgency) || typeof rawAgency.path !== "string") {
      throw new Error(
        `ci/transit-config.json agencies[${index}] must define a path`,
      );
    }
    return { path: rawAgency.path };
  });

  return {
    sqlitePath: parsed.sqlitePath,
    agencies,
  };
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

function isBuildStep(step: WorkflowStep): boolean {
  return runLines(step).some((line) => /^npm\s+run\s+build(?:\s|$)/.test(line));
}

function isTransitConfigCleanupCommand(command: string): boolean {
  const words = shellWords(command);
  if (words === null || words.length < 2 || words[0] !== "rm") {
    return false;
  }

  const rawArguments = words.slice(1);
  const target = rawArguments.at(-1);
  const options = rawArguments.slice(0, -1);
  const hasOnlyForceOptions = options.every(
    (option) => option === "-f" || option === "--force" || option === "--",
  );

  return (
    target !== undefined &&
    hasOnlyForceOptions &&
    isExactRootRelativePath(target, "transit-config.json")
  );
}

function isTransitConfigCleanupStep(step: WorkflowStep): boolean {
  return runLines(step).some(isTransitConfigCleanupCommand);
}

function isAlwaysCondition(value: unknown): boolean {
  return value === "always()" || value === "${{ always() }}";
}

function defaultWorkingDirectory(defaults: unknown): unknown {
  if (!isMapping(defaults) || !isMapping(defaults.run)) {
    return undefined;
  }
  return hasOwn(defaults.run, "working-directory")
    ? defaults.run["working-directory"]
    : undefined;
}

function effectiveWorkingDirectory(
  workflow: WorkflowDocument,
  job: WorkflowJob,
  step: WorkflowStep,
): unknown {
  if (hasOwn(step, "working-directory")) {
    return step["working-directory"];
  }

  const jobDirectory = defaultWorkingDirectory(job.defaults);
  if (jobDirectory !== undefined) {
    return jobDirectory;
  }

  return defaultWorkingDirectory(workflow.defaults);
}

function isRepositoryRootWorkingDirectory(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().replace(/\/+$/, "") || ".";
  return normalized === "." || normalized === "${{ github.workspace }}";
}

function isRepositoryRelativePath(value: string): boolean {
  if (value.length === 0 || path.isAbsolute(value)) {
    return false;
  }

  const normalizedSeparators = value.replaceAll("\\", "/");
  return (
    !normalizedSeparators.startsWith("/") &&
    !normalizedSeparators.split("/").includes("..")
  );
}

function isWithinRepository(candidate: string): boolean {
  const relative = path.relative(repositoryRoot, candidate);
  return (
    relative.length > 0 &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function hasExplicitTemporaryBoundary(value: string): boolean {
  const segments = value.replaceAll("\\", "/").split("/");
  return segments.some((segment) =>
    [".temp", "temp", "tmp"].includes(segment.toLowerCase()),
  );
}

function stepIndex(
  steps: WorkflowStep[],
  predicate: (step: WorkflowStep) => boolean,
): number {
  return steps.findIndex(predicate);
}

function buildJob(workflow: WorkflowDocument): WorkflowJob {
  const buildJobs = workflow.jobs.filter((job) => job.steps.some(isBuildStep));
  expect(buildJobs).toHaveLength(1);

  const job = buildJobs[0];
  if (job === undefined) {
    throw new Error("quality-gate.yml must contain one build job");
  }
  return job;
}

type GitCheckIgnoreResult = {
  status: number | null;
  stdout: string;
};

function runGitCheckIgnore(relativePath: string): GitCheckIgnoreResult {
  const result = spawnSync(
    "git",
    ["check-ignore", "--no-index", "--", relativePath],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );

  return {
    status: result.status,
    stdout: result.stdout?.toString() ?? "",
  };
}

describe("Quality Gateのtransit-config相対path/root/temp境界契約", () => {
  it("configのGTFS pathとDB出力をrepository内の実在fixtureまたは明示的tempへ限定する", () => {
    const config = parseTransitConfig();

    expect(config.agencies.length).toBeGreaterThan(0);
    for (const agency of config.agencies) {
      expect(path.isAbsolute(agency.path)).toBe(false);
      expect(isRepositoryRelativePath(agency.path)).toBe(true);

      const resolvedFixturePath = path.resolve(repositoryRoot, agency.path);
      expect(isWithinRepository(resolvedFixturePath)).toBe(true);
      expect(fs.existsSync(resolvedFixturePath)).toBe(true);
      expect(fs.statSync(resolvedFixturePath).isDirectory()).toBe(true);
    }

    expect(path.isAbsolute(config.sqlitePath)).toBe(false);
    expect(isRepositoryRelativePath(config.sqlitePath)).toBe(true);
    expect(
      isWithinRepository(path.resolve(repositoryRoot, config.sqlitePath)),
    ).toBe(true);
    expect(hasExplicitTemporaryBoundary(config.sqlitePath)).toBe(true);

  });

  it("rootの一時configだけをignoreし、ciのfixture configは追跡可能にする", () => {
    const rootConfigCheck = runGitCheckIgnore("transit-config.json");
    expect(rootConfigCheck.status).toBe(0);
    expect(rootConfigCheck.stdout.trim()).toBe("transit-config.json");

    const ciConfigCheck = runGitCheckIgnore("ci/transit-config.json");
    expect(ciConfigCheck.status).toBe(1);
    expect(ciConfigCheck.stdout.trim()).toBe("");
  });

  it("root配置からbuildを実行し、成功・失敗のいずれでも終了時にroot一時configを削除する", () => {
    const workflow = parseWorkflow();
    const job = buildJob(workflow);
    const { steps } = job;

    const placementIndex = stepIndex(steps, isTransitConfigPlacementStep);
    const buildIndex = stepIndex(steps, isBuildStep);

    expect(placementIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeGreaterThan(placementIndex);
    expect(
      isRepositoryRootWorkingDirectory(
        effectiveWorkingDirectory(workflow, job, steps[placementIndex] ?? {}),
      ),
    ).toBe(true);
    expect(
      isRepositoryRootWorkingDirectory(
        effectiveWorkingDirectory(workflow, job, steps[buildIndex] ?? {}),
      ),
    ).toBe(true);

    const cleanupIndices = steps
      .map((step, index) => ({ step, index }))
      .filter(
        ({ step, index }) =>
          index > buildIndex &&
          isAlwaysCondition(step.if) &&
          isTransitConfigCleanupStep(step),
      )
      .map(({ index }) => index);

    expect(cleanupIndices).toHaveLength(1);
    const cleanupIndex = cleanupIndices[0];
    expect(cleanupIndex).toBe(steps.length - 1);
    expect(
      isRepositoryRootWorkingDirectory(
        effectiveWorkingDirectory(
          workflow,
          job,
          steps[cleanupIndex ?? -1] ?? {},
        ),
      ),
    ).toBe(true);
  });
});
