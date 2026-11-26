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

/**
 * 属性のないspanでも、折り返す必要のある文字列を包むものは残す。
 * DaisyUIのbadgeはinline-flexであり、rubyを直に置くと各rubyがflex項目に
 * なって折り返さない。spanが1つのテキスト箱になることで、狭いセルでも
 * ルビ付きの文字列が折り返せる。
 */
const WRAPPING_TEXT_SPAN_PATTERN = /<span\s*>([\s\S]*?)<\/span>/g;

describe("Issue #106 span and DaisyUI gap contract", () => {
  it("production TSXに、静的な文字列だけを包む属性なしのspanを残さない", () => {
    const violations = readProductionSources().flatMap((source) => {
      const matches: string[] = [];
      WRAPPING_TEXT_SPAN_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = WRAPPING_TEXT_SPAN_PATTERN.exec(source.content)) !== null) {
        if (match[1].includes("{")) continue;
        matches.push(`${source.path}:${lineNumber(source.content, match.index)}`);
      }
      return matches;
    });

    expect(violations).toEqual([]);
  });

  it("折り返す必要のあるルビ付き文字列は、spanで包んだままにする", () => {
    const licenseSource = readFileSync(
      path.resolve(process.cwd(), "src/app/license/page.tsx"),
      "utf8",
    );

    expect(licenseSource).toMatch(
      /<span>\{entry\.licenseName\}<\/span>/,
    );
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

  it("共通Buttonのspanはルビ文字列の境界として使う", () => {
    const buttonSource = readFileSync(
      path.resolve(process.cwd(), "src/components/ui/Button.tsx"),
      "utf8",
    );
    const spans = [...buttonSource.matchAll(/<span\b[^>]*>/g)];
    expect(spans).toHaveLength(2);
    expect(spans[0][0]).toContain('className="ruby-text"');
    expect(spans[0][0]).toContain('aria-hidden="true"');
    expect(spans[1][0]).toContain('className="sr-only"');
    expect(buttonSource).toContain("gap-0");
  });
});
