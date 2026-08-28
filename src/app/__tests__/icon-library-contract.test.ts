import fs from "node:fs";
import path from "node:path";

type PackageManifest = {
  dependencies?: Record<string, string>;
};

type ProductionSourceFile = {
  relativePath: string;
  source: string;
};

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const TEST_FILE_PATTERN = /(?:^|[.-])(?:test|spec)(?:\.[^.]+)*\.[^.]+$/;
const FORBIDDEN_LEGACY_LIBRARIES = ["@heroicons/react", "react-icons"];
const FORBIDDEN_SVG_FRAGMENTS = [
  'xmlns="http://www.w3.org/2000/svg"',
  "<path",
  "<circle",
  "<line",
  "<polyline",
  "<polygon",
  "<rect",
];
const LUCIDE_IMPORT_PATTERN =
  /^\s*import\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*\s+as\s+\w+|[\w$]+(?:\s*,\s*(?:\{[\s\S]*?\}|\*\s+as\s+\w+))?)\s+from\s+["']lucide-react["']\s*;?/m;

const toRepositoryPath = (filePath: string) =>
  path.relative(process.cwd(), filePath).split(path.sep).join("/");

const collectProductionFilePaths = (directory: string): string[] => {
  const entries = fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  return entries.flatMap((entry) => {
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") {
        return [];
      }

      return collectProductionFilePaths(path.join(directory, entry.name));
    }

    const extension = path.extname(entry.name);
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extension)) {
      return [];
    }

    if (TEST_FILE_PATTERN.test(entry.name)) {
      return [];
    }

    return [path.join(directory, entry.name)];
  });
};

const productionSourceFiles: ProductionSourceFile[] = [
  path.resolve(process.cwd(), "src/app"),
  path.resolve(process.cwd(), "src/components"),
]
  .flatMap(collectProductionFilePaths)
  .sort((left, right) => left.localeCompare(right))
  .map((filePath) => ({
    relativePath: toRepositoryPath(filePath),
    source: fs.readFileSync(filePath, "utf8"),
  }));

const packageManifest = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")
) as PackageManifest;
const directDependencies = packageManifest.dependencies ?? {};

describe("Lucideアイコン統一の静的契約", () => {
  it("production sourceを対象ディレクトリから決定的に列挙する", () => {
    expect(productionSourceFiles.length).toBeGreaterThan(0);
    expect(
      productionSourceFiles.every(({ relativePath }) => {
        const isTargetRoot =
          relativePath.startsWith("src/app/") ||
          relativePath.startsWith("src/components/");
        const isSourceFile = SOURCE_EXTENSIONS.has(path.extname(relativePath));
        const isExcludedTest =
          relativePath.includes("/__tests__/") ||
          TEST_FILE_PATTERN.test(path.basename(relativePath));

        return isTargetRoot && isSourceFile && !isExcludedTest;
      })
    ).toBe(true);
    expect(
      productionSourceFiles.some(({ relativePath }) =>
        relativePath.startsWith("src/app/")
      )
    ).toBe(true);
    expect(
      productionSourceFiles.some(({ relativePath }) =>
        relativePath.startsWith("src/components/")
      )
    ).toBe(true);
    expect(
      productionSourceFiles.some(
        ({ relativePath }) => relativePath === "src/app/icon.svg"
      )
    ).toBe(false);
  });

  it("production sourceに旧アイコンライブラリのimportや参照を残さない", () => {
    const violations = productionSourceFiles.flatMap(
      ({ relativePath, source }) => {
        const matches = FORBIDDEN_LEGACY_LIBRARIES.filter((library) =>
          source.includes(library)
        );

        return matches.map((library) => `${relativePath}: ${library}`);
      }
    );

    expect(violations).toEqual([]);
  });

  it("production sourceに手書きSVG断片を残さない", () => {
    const violations = productionSourceFiles.flatMap(
      ({ relativePath, source }) => {
        const matches = FORBIDDEN_SVG_FRAGMENTS.filter((fragment) =>
          source.includes(fragment)
        );

        return matches.map((fragment) => `${relativePath}: ${fragment}`);
      }
    );

    expect(violations).toEqual([]);
  });

  it("package.jsonでLucideを直接依存し旧ライブラリを直接依存しない", () => {
    const dependencyViolations: string[] = [];

    if (!directDependencies["lucide-react"]) {
      dependencyViolations.push("package.json: lucide-react が未導入");
    }

    FORBIDDEN_LEGACY_LIBRARIES.forEach((library) => {
      if (directDependencies[library]) {
        dependencyViolations.push(`package.json: ${library}`);
      }
    });

    expect(dependencyViolations).toEqual([]);
  });

  it("production sourceにLucideのimportが少なくとも1件ある", () => {
    const lucideImportFiles = productionSourceFiles
      .filter(({ source }) => LUCIDE_IMPORT_PATTERN.test(source))
      .map(({ relativePath }) => relativePath);

    expect(lucideImportFiles.length).toBeGreaterThan(0);
  });
});
