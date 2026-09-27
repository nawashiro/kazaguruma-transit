import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

type YamlMapping = Record<string, unknown>;

type WorkflowStep = YamlMapping & {
  name?: unknown;
  run?: unknown;
  uses?: unknown;
};

type WorkflowJob = YamlMapping & {
  id: string;
  steps: WorkflowStep[];
};

type WorkflowDocument = {
  trigger: unknown;
  jobs: WorkflowJob[];
};

type YamlModule = {
  load: (source: string) => unknown;
};

type TransitConfigAgency = YamlMapping & {
  path: string;
};

type TransitConfig = YamlMapping & {
  agencies: TransitConfigAgency[];
};

type TransitBoundary = {
  configSourcePath: string;
  rootConfigPath: string;
  gtfsPaths: string[];
};

type CommandIO = {
  inputs: string[];
  outputs: string[];
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

function isMapping(value: unknown): value is YamlMapping {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
      return rawStep as WorkflowStep;
    });

    return { ...rawJob, id, steps };
  });

  return { trigger: parsed.on, jobs };
}

function parseTransitConfig(): TransitConfig {
  const parsed: unknown = JSON.parse(
    fs.readFileSync(transitConfigPath, "utf8"),
  );

  if (!isMapping(parsed) || !Array.isArray(parsed.agencies)) {
    throw new Error("ci/transit-config.json must define an agencies array");
  }

  const agencies = parsed.agencies.map((rawAgency, index) => {
    if (!isMapping(rawAgency) || typeof rawAgency.path !== "string") {
      throw new Error(
        `ci/transit-config.json agencies[${index}] must define a path`,
      );
    }
    return rawAgency as TransitConfigAgency;
  });

  return { ...parsed, agencies };
}

function scalarStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(scalarStrings);
  }

  if (isMapping(value)) {
    return Object.entries(value).flatMap(([key, entry]) => [
      key,
      ...scalarStrings(entry),
    ]);
  }

  return [];
}

function commandText(value: unknown): string {
  if (!isMapping(value)) {
    return "";
  }

  return [value.run, value.uses]
    .filter((entry): entry is string => typeof entry === "string")
    .join("\n");
}

function stepPayload(step: WorkflowStep): YamlMapping {
  const payload: YamlMapping = {};
  for (const [key, value] of Object.entries(step)) {
    if (key !== "name") {
      payload[key] = value;
    }
  }
  return payload;
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

function isBuildStep(step: WorkflowStep): boolean {
  return runLines(step).some((line) => /^npm\s+run\s+build(?:\s|$)/.test(line));
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

function normalizeRelativePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
}

function isUrlLike(value: string): boolean {
  return /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/.test(value);
}

function isRepositoryRelativePath(value: string): boolean {
  const normalized = normalizeRelativePath(value);
  if (
    normalized.length === 0 ||
    isUrlLike(normalized) ||
    path.isAbsolute(normalized)
  ) {
    return false;
  }

  const resolved = path.resolve(repositoryRoot, normalized);
  const relative = path.relative(repositoryRoot, resolved);
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

const urlPattern = /\bhttps?:\/\/[^\s"'`<>]+/gi;

function urlsIn(value: unknown): string[] {
  return scalarStrings(value).flatMap((text) => text.match(urlPattern) ?? []);
}

function isLocalUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "::1"
    );
  } catch {
    return false;
  }
}

function externalUrlsIn(value: unknown): string[] {
  return urlsIn(value).filter((url) => !isLocalUrl(url));
}

const secretReferencePattern = /\bsecrets\.[A-Za-z_][A-Za-z0-9_-]*/i;

function secretReferences(value: unknown): string[] {
  return scalarStrings(value).flatMap(
    (text) => text.match(secretReferencePattern) ?? [],
  );
}

const downloadCommandPattern =
  /\b(?:curl|wget|download(?:[-_ ]artifact)?|invoke-webrequest|aria2c|fetch|git\s+clone|gh\s+(?:release\s+)?download|(?:aws|azcopy|gsutil)\s+(?:s3\s+)?cp)\b/i;

function isDownloadLikeValue(value: unknown): boolean {
  return downloadCommandPattern.test(scalarStrings(value).join("\n"));
}

function isDownloadLikeStep(step: WorkflowStep): boolean {
  return downloadCommandPattern.test(commandText(step));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathMentionPattern(relativePath: string): RegExp {
  const normalized = normalizeRelativePath(relativePath);
  const escaped = normalized.split("/").map(escapeRegExp).join("/");
  return new RegExp(
    `(?:^|[^A-Za-z0-9_.-])(?:\\.\\/)?${escaped}(?=$|[^A-Za-z0-9_.-])`,
    "i",
  );
}

function mentionsRelativePath(value: unknown, relativePath: string): boolean {
  const pattern = pathMentionPattern(relativePath);
  return scalarStrings(value).some((text) =>
    pattern.test(text.replaceAll("\\", "/")),
  );
}

function transitPathReferencesIn(
  value: unknown,
  boundary: TransitBoundary,
): string[] {
  const candidates = [
    boundary.configSourcePath,
    boundary.rootConfigPath,
    ...boundary.gtfsPaths,
  ];
  return candidates.filter(
    (candidate, index) =>
      candidates.indexOf(candidate) === index &&
      mentionsRelativePath(value, candidate),
  );
}

function isTransitExecutionStep(step: WorkflowStep): boolean {
  return /\bnpm\s+run\s+(?:build|import-gtfs)\b/i.test(commandText(step));
}

function isTransitInputStep(
  step: WorkflowStep,
  boundary: TransitBoundary,
): boolean {
  return (
    isTransitExecutionStep(step) ||
    transitPathReferencesIn(stepPayload(step), boundary).length > 0
  );
}

function isFixturePlacementCommand(
  command: string,
  boundary: TransitBoundary,
): boolean {
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
  const sourcePath = normalizeRelativePath(source ?? "");
  const destinationPath = normalizeRelativePath(destination ?? "");
  return (
    sourcePath === boundary.configSourcePath &&
    destinationPath === boundary.rootConfigPath
  );
}

function isFixturePlacementStep(
  step: WorkflowStep,
  boundary: TransitBoundary,
): boolean {
  return runLines(step).some((line) =>
    isFixturePlacementCommand(line, boundary),
  );
}

function addDataPath(paths: string[], value: unknown): void {
  if (typeof value !== "string") {
    return;
  }

  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed === "-" ||
    trimmed.startsWith("$") ||
    trimmed.includes("${") ||
    isUrlLike(trimmed)
  ) {
    return;
  }

  const normalized = path.posix.normalize(
    trimmed.replaceAll("\\", "/").replace(/^\.\/+/, ""),
  );
  if (normalized !== "." && !paths.includes(normalized)) {
    paths.push(normalized);
  }
}

function commandIO(step: WorkflowStep): CommandIO {
  const inputs: string[] = [];
  const outputs: string[] = [];

  const addInput = (value: unknown): void => addDataPath(inputs, value);
  const addOutput = (value: unknown): void => addDataPath(outputs, value);

  for (const line of runLines(step)) {
    const words = shellWords(line);
    if (words !== null && words.length > 0) {
      const [rawExecutable, ...args] = words;
      const executable = rawExecutable?.split("/").pop() ?? rawExecutable;
      const positional = args.filter(
        (argument) => argument !== "--" && !argument.startsWith("-"),
      );

      if (
        executable === "cp" ||
        executable === "install" ||
        executable === "mv"
      ) {
        if (positional.length >= 2) {
          addOutput(positional[positional.length - 1]);
          positional.slice(0, -1).forEach(addInput);
        }
      }

      const outputFlags = new Set([
        "-o",
        "--output",
        "--output-document",
        "-O",
      ]);
      for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === undefined) {
          continue;
        }
        if (outputFlags.has(argument) && argument !== "-O") {
          addOutput(args[index + 1]);
          index += 1;
        } else if (argument.startsWith("-o") && argument.length > 2) {
          addOutput(argument.slice(2));
        }
      }

      for (const directoryFlag of ["-d", "--directory", "-C"]) {
        const directoryIndex = args.indexOf(directoryFlag);
        if (directoryIndex >= 0) {
          addOutput(args[directoryIndex + 1]);
        }
      }

      if (executable === "unzip" || executable === "tar") {
        const archive = positional[0];
        if (archive !== undefined) {
          addInput(archive);
        }
      }
    }

    const redirectPattern =
      /(?:^|\s)(>>?|<)\s*(?:"([^"]+)"|'([^']+)'|([^\s]+))/g;
    for (const match of line.matchAll(redirectPattern)) {
      const operator = match[1];
      const target = match[2] ?? match[3] ?? match[4];
      if (operator?.startsWith(">")) {
        addOutput(target);
      } else {
        addInput(target);
      }
    }
  }

  if (isMapping(step.with)) {
    for (const key of ["path", "destination", "output"]) {
      addOutput(step.with[key]);
    }
  }

  return { inputs, outputs };
}

function transitInputStepIndices(
  job: WorkflowJob,
  boundary: TransitBoundary,
): number[] {
  const directIndices = new Set<number>();
  const neededDataPaths = new Set<string>();
  const stepIO = job.steps.map(commandIO);

  job.steps.forEach((step, index) => {
    if (!isTransitInputStep(step, boundary)) {
      return;
    }

    directIndices.add(index);
    for (const input of stepIO[index]?.inputs ?? []) {
      neededDataPaths.add(input);
    }
  });

  const transitIndices = new Set(directIndices);
  for (let index = job.steps.length - 1; index >= 0; index -= 1) {
    const io = stepIO[index];
    if (
      io !== undefined &&
      io.outputs.some((output) => neededDataPaths.has(output))
    ) {
      transitIndices.add(index);
      io.inputs.forEach((input) => neededDataPaths.add(input));
    }
  }

  return [...transitIndices].sort((left, right) => left - right);
}

function hasTransitMetadataKey(value: unknown): boolean {
  return (
    isMapping(value) &&
    Object.keys(value).some((key) => /(?:transit|gtfs|agency)/i.test(key))
  );
}

function transitSecretReferencesInJob(
  job: WorkflowJob,
  boundary: TransitBoundary,
): string[] {
  const references = new Set<string>();
  for (const index of transitInputStepIndices(job, boundary)) {
    for (const reference of secretReferences(job.steps[index])) {
      references.add(reference);
    }
  }

  if (
    isMapping(job.env) &&
    (transitPathReferencesIn(job.env, boundary).length > 0 ||
      hasTransitMetadataKey(job.env))
  ) {
    for (const reference of secretReferences(job.env)) {
      references.add(reference);
    }
  }

  return [...references];
}

function validateTransitConfig(config: TransitConfig): TransitBoundary {
  if (config.agencies.length === 0) {
    throw new Error("transit-config.json must define at least one agency");
  }

  if (secretReferences(config).length > 0) {
    throw new Error("transit-config.json must not reference GitHub Secrets");
  }

  if (urlsIn(config).length > 0) {
    throw new Error("transit-config.json must not contain URLs");
  }

  if (isDownloadLikeValue(config)) {
    throw new Error("transit-config.json must not describe an external download");
  }

  for (const agency of config.agencies) {
    if (!isRepositoryRelativePath(agency.path)) {
      throw new Error(`GTFS path is not repository-local: ${agency.path}`);
    }

    const resolvedPath = path.resolve(repositoryRoot, agency.path);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`GTFS path does not exist: ${agency.path}`);
    }
  }

  return {
    configSourcePath: normalizeRelativePath(
      path.relative(repositoryRoot, transitConfigPath),
    ),
    rootConfigPath: "transit-config.json",
    gtfsPaths: config.agencies.map((agency) =>
      normalizeRelativePath(agency.path),
    ),
  };
}

// These production-facing identifiers must remain absent from the synthetic CI input.
const knownProductionGtfsIdentifiers = ["chiyoda", "日立自動車交通"];

function knownProductionIdentifiersIn(value: unknown): string[] {
  const text = scalarStrings(value).join("\n").toLowerCase();
  return knownProductionGtfsIdentifiers.filter((identifier) =>
    text.includes(identifier.toLowerCase()),
  );
}

const workflow = parseWorkflow();
const transitConfig = parseTransitConfig();
const transitBoundary = validateTransitConfig(transitConfig);
const buildJobs = workflow.jobs.filter((job) =>
  job.steps.some(isBuildStep),
);
const transitBuildJobs = buildJobs.filter((job) => {
  const buildIndex = job.steps.findIndex(isBuildStep);
  return (
    buildIndex >= 0 &&
    job.steps.some(
      (step, index) =>
        index < buildIndex && isFixturePlacementStep(step, transitBoundary),
    )
  );
});

describe("Quality GateのCI transit入力安全境界契約", () => {
  it("pull_request_targetをtriggerとして登録せず、通常のpull_requestを使う", () => {
    expect(isMapping(workflow.trigger)).toBe(true);
    if (!isMapping(workflow.trigger)) {
      return;
    }

    expect(
      Object.prototype.hasOwnProperty.call(
        workflow.trigger,
        "pull_request_target",
      ),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(workflow.trigger, "pull_request"),
    ).toBe(true);
  });

  it("configを実際に読み、agencyのGTFS pathがroot配下のローカル入力であることを確認する", () => {
    expect(transitConfig.agencies.length).toBeGreaterThan(0);
    expect(() => validateTransitConfig(transitConfig)).not.toThrow();
    expect(urlsIn(transitConfig)).toEqual([]);
    expect(secretReferences(transitConfig)).toEqual([]);
    expect(isDownloadLikeValue(transitConfig)).toBe(false);
    expect(knownProductionIdentifiersIn(transitConfig)).toEqual([]);

    for (const agency of transitConfig.agencies) {
      expect(path.isAbsolute(agency.path)).toBe(false);
      expect(isRepositoryRelativePath(agency.path)).toBe(true);
      const resolvedPath = path.resolve(repositoryRoot, agency.path);
      expect(fs.existsSync(resolvedPath)).toBe(true);
      expect(fs.statSync(resolvedPath).isDirectory()).toBe(true);
    }
  });

  it("config内のURLを入力境界違反として検出する", () => {
    const externalUrlConfig: TransitConfig = {
      ...transitConfig,
      agencies: transitConfig.agencies.map((agency) => ({
        ...agency,
        path: "https://gtfs.example.test/feed.zip",
      })),
    };

    expect(externalUrlsIn(externalUrlConfig)).toEqual([
      "https://gtfs.example.test/feed.zip",
    ]);
    expect(() => validateTransitConfig(externalUrlConfig)).toThrow();
  });

  it("task 3.1のconfig配置とnpm run buildの関係でtransit build jobを特定する", () => {
    expect(buildJobs.length).toBeGreaterThan(0);
    expect(transitBuildJobs.length).toBeGreaterThan(0);

    for (const job of transitBuildJobs) {
      const buildIndex = job.steps.findIndex(isBuildStep);
      const placementIndices = job.steps.flatMap((step, index) =>
        isFixturePlacementStep(step, transitBoundary) ? [index] : [],
      );

      expect(buildIndex).toBeGreaterThanOrEqual(0);
      expect(placementIndices).toHaveLength(1);
      const [placementIndex] = placementIndices;
      expect(placementIndex).toBeDefined();
      if (placementIndex === undefined) {
        continue;
      }

      expect(placementIndex).toBeLessThan(buildIndex);
      expect(
        transitPathReferencesIn(
          job.steps[placementIndex],
          transitBoundary,
        ),
      ).toEqual(
        expect.arrayContaining([
          transitBoundary.configSourcePath,
          transitBoundary.rootConfigPath,
        ]),
      );
    }
  });

  it("選択したtransit build経路だけを検査し、Secret・本番識別子・外部取得を許可しない", () => {
    for (const job of transitBuildJobs) {
      const transitIndices = transitInputStepIndices(job, transitBoundary);
      expect(transitIndices.length).toBeGreaterThan(0);
      expect(transitSecretReferencesInJob(job, transitBoundary)).toEqual([]);

      for (const index of transitIndices) {
        const step = job.steps[index];
        expect(step).toBeDefined();
        expect(secretReferences(step)).toEqual([]);
        expect(knownProductionIdentifiersIn(step)).toEqual([]);
        expect(externalUrlsIn(step)).toEqual([]);
        expect(isDownloadLikeStep(step)).toBe(false);
      }
    }
  });

  it("localhost疎通stepをtransit入力と誤判定せず、禁止経路の回帰fixtureは検出する", () => {
    const healthCheckSteps = transitBuildJobs.flatMap((job) =>
      job.steps.filter((step) =>
        commandText(step).includes("http://127.0.0.1:3100"),
      ),
    );

    expect(healthCheckSteps.length).toBeGreaterThan(0);
    for (const step of healthCheckSteps) {
      expect(isTransitInputStep(step, transitBoundary)).toBe(false);
      expect(isDownloadLikeStep(step)).toBe(true);
      expect(externalUrlsIn(step)).toEqual([]);
    }

    const configuredGtfsPath = transitBoundary.gtfsPaths[0];
    expect(configuredGtfsPath).toBeDefined();
    if (configuredGtfsPath === undefined) {
      return;
    }

    const neutralExternalDownload: WorkflowStep = {
      name: "Prepare dependency cache",
      run: `curl --fail https://downloads.example.test/feed.zip --output "${configuredGtfsPath}/feed.zip"`,
    };
    expect(isTransitInputStep(neutralExternalDownload, transitBoundary)).toBe(
      true,
    );
    expect(
      transitPathReferencesIn(neutralExternalDownload, transitBoundary),
    ).toContain(configuredGtfsPath);
    expect(isDownloadLikeStep(neutralExternalDownload)).toBe(true);
    expect(externalUrlsIn(neutralExternalDownload)).not.toEqual([]);

    const artifactStep: WorkflowStep = {
      name: "Prepare dependency cache",
      uses: "actions/download-artifact@v4",
      with: { path: configuredGtfsPath },
    };
    expect(isTransitInputStep(artifactStep, transitBoundary)).toBe(true);
    expect(isDownloadLikeStep(artifactStep)).toBe(true);

    const indirectExternalDownloadJob: WorkflowJob = {
      id: "synthetic-transit-build",
      steps: [
        {
          name: "Prepare dependency cache",
          run: "curl --fail https://downloads.example.test/feed.zip --output /tmp/feed.zip",
        },
        {
          name: "Stage build input",
          run: `cp /tmp/feed.zip "${configuredGtfsPath}/feed.zip"`,
        },
        { name: "Build", run: "npm run build" },
      ],
    };
    expect(
      transitInputStepIndices(indirectExternalDownloadJob, transitBoundary),
    ).toEqual(expect.arrayContaining([0, 1, 2]));
  });

  it("Secretのスコープをtransit入力へ限定し、無関係Secretは許容する", () => {
    const unrelatedSecretStep: WorkflowStep = {
      name: "Publish coverage",
      run: "printf '%s' '${{ secrets.COVERAGE_TOKEN }}' > coverage/token.txt",
    };
    const safeJob: WorkflowJob = {
      id: "quality-gate-with-unrelated-secret",
      env: { COVERAGE_TOKEN: "${{ secrets.COVERAGE_TOKEN }}" },
      steps: [
        {
          name: "Place config",
          run: `cp "${transitBoundary.configSourcePath}" "${transitBoundary.rootConfigPath}"`,
        },
        unrelatedSecretStep,
        { name: "Build", run: "npm run build" },
      ],
    };

    expect(secretReferences(safeJob)).not.toEqual([]);
    expect(
      transitInputStepIndices(safeJob, transitBoundary),
    ).not.toContain(1);
    expect(transitSecretReferencesInJob(safeJob, transitBoundary)).toEqual([]);

    const transitSecretJob: WorkflowJob = {
      id: "quality-gate-with-transit-secret",
      env: {
        GTFS_PATH: transitBoundary.gtfsPaths[0],
        TRANSIT_TOKEN: "${{ secrets.TRANSIT_TOKEN }}",
      },
      steps: [
        {
          name: "Place config",
          run: `cp "${transitBoundary.configSourcePath}" "${transitBoundary.rootConfigPath}"`,
        },
        { name: "Build", run: "npm run build" },
      ],
    };
    expect(
      transitSecretReferencesInJob(transitSecretJob, transitBoundary),
    ).toContain("secrets.TRANSIT_TOKEN");
  });

  it("known production identifier helperはchiyodaと日立自動車交通を検出する", () => {
    expect(
      knownProductionIdentifiersIn({
        agency_key: "CHiYoDa",
        agency_name: "日立自動車交通",
      }),
    ).toEqual(["chiyoda", "日立自動車交通"]);
    expect(knownProductionIdentifiersIn({ agency_key: "synthetic" })).toEqual(
      [],
    );
  });
});
