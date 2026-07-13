import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const MINIMUM_FONT_SIZE_PX = 14;
const SOURCE_ROOTS = ["src/app", "src/components"];
const EXCLUDED_PATH_PARTS = ["/api/pdf/"];

type SourceFile = {
  path: string;
  content: string;
};

function listSourceFiles(): string[] {
  const output = execFileSync(
    "rg",
    ["--files", ...SOURCE_ROOTS, "-g", "*.tsx", "-g", "*.css"],
    { encoding: "utf8" }
  );

  return output
    .trim()
    .split("\n")
    .filter((filePath) => filePath.length > 0)
    .filter((filePath) => !EXCLUDED_PATH_PARTS.some((part) => filePath.includes(part)));
}

async function loadSourceFiles(): Promise<SourceFile[]> {
  const filePaths = listSourceFiles();

  return Promise.all(
    filePaths.map(async (filePath) => ({
      path: filePath,
      content: await readFile(path.resolve(process.cwd(), filePath), "utf8"),
    }))
  );
}

function parseCssSizeToPx(value: string): number | null {
  const normalizedValue = value.trim().toLowerCase();
  const match = normalizedValue.match(/^([0-9.]+)(px|rem|em|%)$/);

  if (!match) {
    return null;
  }

  const numericValue = Number(match[1]);
  const unit = match[2];

  if (unit === "px") return numericValue;
  if (unit === "%") return (numericValue / 100) * 16;
  return numericValue * 16;
}

function findSmallUtilityClasses(sourceFile: SourceFile): string[] {
  const violations: string[] = [];
  const sourceLines = sourceFile.content.split("\n");

  for (const [index, line] of sourceLines.entries()) {
    const className = line;
    const hasRubyException = /(?:^|\s)ruby-text(?:\s|$)/.test(className);
    const smallClasses = className.match(/(?:^|[\s"'])text-(?:xs|\[[^\]]+\])/g) ?? [];

    for (const smallClass of smallClasses) {
      if (hasRubyException && smallClass.includes("text-[")) continue;

      const arbitraryValue = smallClass.match(/text-\[([^\]]+)\]/)?.[1];
      const isSmallArbitraryValue = arbitraryValue
        ? (parseCssSizeToPx(arbitraryValue) ?? MINIMUM_FONT_SIZE_PX) < MINIMUM_FONT_SIZE_PX
        : smallClass.includes("text-xs");

      if (isSmallArbitraryValue && !hasRubyException) {
        violations.push(`${sourceFile.path}:${index + 1}: class ${smallClass.trim()}`);
      }
    }
  }

  return violations;
}

function findSmallCssDeclarations(sourceFile: SourceFile): string[] {
  if (!sourceFile.path.endsWith(".css")) return [];

  const violations: string[] = [];
  let currentSelector = "";

  for (const [index, line] of sourceFile.content.split("\n").entries()) {
    const selector = line.match(/^([^{}]+)\{/)?.[1]?.trim();
    if (selector) currentSelector = selector;

    const declaration = line.match(/font-size\s*:\s*([^;]+)/)?.[1];
    if (!declaration || /\brt\b/.test(currentSelector)) continue;

    const sizeInPx = parseCssSizeToPx(declaration);
    if (sizeInPx !== null && sizeInPx < MINIMUM_FONT_SIZE_PX) {
      violations.push(`${sourceFile.path}:${index + 1}: font-size ${declaration.trim()}`);
    }
  }

  return violations;
}

function findSmallDaisyUiClasses(sourceFile: SourceFile): string[] {
  const violations: string[] = [];

  for (const [index, line] of sourceFile.content.split("\n").entries()) {
    if (/\bbadge-sm\b/.test(line)) {
      violations.push(`${sourceFile.path}:${index + 1}: class badge-sm`);
    }

    if (/\bbtn-sm\b/.test(line) && !/\bbtn-circle\b/.test(line)) {
      violations.push(`${sourceFile.path}:${index + 1}: class btn-sm`);
    }
  }

  return violations;
}

describe("UI minimum font-size compliance", () => {
  it("rejects sub-14px utility classes and CSS declarations outside ruby text", async () => {
    const sourceFiles = await loadSourceFiles();
    const violations = sourceFiles.flatMap((sourceFile) => [
      ...findSmallUtilityClasses(sourceFile),
      ...findSmallCssDeclarations(sourceFile),
      ...findSmallDaisyUiClasses(sourceFile),
    ]);

    expect(violations).toEqual([]);
  });

  it("keeps the sub-14px exception limited to ruby annotation text", async () => {
    const sourceFiles = await loadSourceFiles();
    const globalStyles = sourceFiles.find(
      (sourceFile) => sourceFile.path === "src/app/globals.css"
    );

    expect(globalStyles).toBeDefined();
    expect(globalStyles?.content).toMatch(/rt\s*\{[\s\S]*font-size\s*:\s*70%/);
    expect(globalStyles ? findSmallCssDeclarations(globalStyles) : []).toEqual([]);
  });
});
