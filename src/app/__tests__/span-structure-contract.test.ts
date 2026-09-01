import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const PRODUCTION_SOURCE_ROOTS = ["src/app", "src/components"];

type SourceRecord = {
  path: string;
  content: string;
};

function collectProductionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return collectProductionSourceFiles(entryPath);
    }
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) return [];
    if (entry.name.endsWith(".test.tsx") || entry.name.endsWith(".spec.tsx")) {
      return [];
    }
    return [entryPath];
  });
}

function readProductionSources(): SourceRecord[] {
  return PRODUCTION_SOURCE_ROOTS.flatMap((directory) =>
    collectProductionSourceFiles(path.resolve(process.cwd(), directory)),
  )
    .sort()
    .map((filePath) => ({
      path: path.relative(process.cwd(), filePath),
      content: readFileSync(filePath, "utf8"),
    }));
}

function lineNumber(content: string, offset: number): number {
  return content.slice(0, offset).split("\n").length;
}

function collectClassNameViolations(
  sources: SourceRecord[],
  classToken: "btn" | "card-title",
): string[] {
  const violations: string[] = [];
  const staticPattern = /className="([^"]*)"/g;
  const templatePattern = /className=\{`([\s\S]*?)`\}/g;

  for (const source of sources) {
    for (const [pattern, isTemplate] of [
      [staticPattern, false],
      [templatePattern, true],
    ] as const) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source.content)) !== null) {
        const classExpression = match[1];
        if (
          !classExpression.split(/\s+/).includes(classToken) ||
          classExpression.includes("gap-0")
        ) {
          continue;
        }
        const suffix = isTemplate ? " (template)" : "";
        violations.push(
          `${source.path}:${lineNumber(source.content, match.index)}${suffix}`,
        );
      }
    }
  }

  return violations;
}

describe("Issue #106 span and DaisyUI gap contract", () => {
  it("production TSXに属性のないspanを残さない", () => {
    const violations = readProductionSources().flatMap((source) => {
      const matches: string[] = [];
      const pattern = /<span\s*>/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source.content)) !== null) {
        matches.push(`${source.path}:${lineNumber(source.content, match.index)}`);
      }
      return matches;
    });

    expect(violations).toEqual([]);
  });

  it("DaisyUIのbtnへgap-0を明示する", () => {
    const violations = collectClassNameViolations(readProductionSources(), "btn");

    expect(violations).toEqual([]);
  });

  it("DaisyUIのcard-titleへgap-0を明示する", () => {
    const violations = collectClassNameViolations(
      readProductionSources(),
      "card-title",
    );

    expect(violations).toEqual([]);
  });

  it("共通Buttonが構造用spanを自動生成しない", () => {
    const buttonSource = readFileSync(
      path.resolve(process.cwd(), "src/components/ui/Button.tsx"),
      "utf8",
    );
    const spanOffset = buttonSource.indexOf("<span");
    const violations = spanOffset === -1
      ? []
      : [`src/components/ui/Button.tsx:${lineNumber(buttonSource, spanOffset)}`];

    expect(violations).toEqual([]);
    expect(buttonSource).toContain("ruby-text");
    expect(buttonSource).toContain("gap-0");
  });
});
