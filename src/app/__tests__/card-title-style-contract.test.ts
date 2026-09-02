import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type * as TypeScript from "typescript";

// jest.setup.js mocks fs for API tests; this contract reads the real source tree.
jest.unmock("fs");
jest.unmock("node:fs");
jest.unmock("typescript");
const ts: typeof import("typescript") = jest.requireActual("typescript");

const PRODUCTION_ROOTS = ["src"];
const EXCLUDED_DIRECTORY_NAMES = new Set([
  "__tests__",
  "__mocks__",
  "tests",
  "fixtures",
  "docs",
]);
const CARD_TITLE_TOKEN = /(^|\s)card-title(?=\s|$)/;

type SourceRecord = {
  path: string;
  sourceFile: TypeScript.SourceFile;
};

type CardTitleLiteral = {
  path: string;
  line: number;
  start: number;
  node: TypeScript.Node;
};

type CardTitleUse = {
  path: string;
  line: number;
  className: string | null;
  literalKey: string;
};

function collectProductionPaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORY_NAMES.has(entry.name)) return [];
      return collectProductionPaths(entryPath);
    }
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) return [];
    if (entry.name.endsWith(".test.tsx") || entry.name.endsWith(".spec.tsx")) {
      return [];
    }
    return [entryPath];
  });
}

function readProductionSources(): SourceRecord[] {
  return PRODUCTION_ROOTS.flatMap((root) =>
    collectProductionPaths(path.resolve(process.cwd(), root)),
  )
    .sort()
    .map((filePath) => {
      const relativePath = path.relative(process.cwd(), filePath);
      return {
        path: relativePath,
        sourceFile: ts.createSourceFile(
          relativePath,
          readFileSync(filePath, "utf8"),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        ),
      };
    });
}

function getLiteralText(node: TypeScript.Node): string | null {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    return node.text;
  }
  return null;
}

function isCardTitleLiteral(node: TypeScript.Node): boolean {
  const literalText = getLiteralText(node);
  return literalText !== null && CARD_TITLE_TOKEN.test(literalText);
}

function collectCardTitleLiteralsForSource(
  sourcePath: string,
  sourceFile: TypeScript.SourceFile,
): CardTitleLiteral[] {
  const literals: CardTitleLiteral[] = [];

  function visit(node: TypeScript.Node): void {
    if (isCardTitleLiteral(node)) {
      const start = node.getStart(sourceFile);
      literals.push({
        path: sourcePath,
        line: sourceFile.getLineAndCharacterOfPosition(start).line + 1,
        start,
        node,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return literals;
}

function collectCardTitleLiterals(sources: SourceRecord[]): CardTitleLiteral[] {
  return sources.flatMap(({ path: sourcePath, sourceFile }) =>
    collectCardTitleLiteralsForSource(sourcePath, sourceFile),
  );
}

function getEnclosingClassNameAttribute(
  node: TypeScript.Node,
): TypeScript.JsxAttribute | null {
  let current: TypeScript.Node | undefined = node.parent;
  while (current) {
    if (ts.isJsxAttribute(current)) {
      return ts.isIdentifier(current.name) && current.name.text === "className"
        ? current
        : null;
    }
    if (
      ts.isJsxOpeningElement(current) ||
      ts.isJsxSelfClosingElement(current) ||
      ts.isJsxElement(current) ||
      ts.isSourceFile(current)
    ) {
      return null;
    }
    current = current.parent;
  }
  return null;
}

function getStaticClassName(attribute: TypeScript.JsxAttribute): string | null {
  const initializer = attribute.initializer;
  if (!initializer) return null;

  if (ts.isStringLiteral(initializer)) {
    return initializer.text;
  }
  if (ts.isJsxExpression(initializer)) {
    const expression = initializer.expression;
    if (expression && ts.isStringLiteral(expression)) return expression.text;
    if (expression && ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text;
    }
  }
  return null;
}

function getLiteralKey(literal: CardTitleLiteral): string {
  return `${literal.path}:${literal.start}`;
}

function collectCardTitleUses(sources: SourceRecord[]): CardTitleUse[] {
  return sources.flatMap(({ path: sourcePath, sourceFile }) => {
    const literals = collectCardTitleLiteralsForSource(sourcePath, sourceFile);
    return literals.flatMap((literal) => {
      const classNameAttribute = getEnclosingClassNameAttribute(literal.node);
      if (!classNameAttribute) return [];

      return [
        {
          path: sourcePath,
          line: literal.line,
          className: getStaticClassName(classNameAttribute),
          literalKey: getLiteralKey(literal),
        },
      ];
    });
  });
}

describe("Issue #128 card-title inline contract", () => {
  it("tests・fixture・docsを除くproduction全21箇所のcard-titleへinlineを付ける", () => {
    const productionSources = readProductionSources();
    const allCardTitleLiterals = collectCardTitleLiterals(productionSources);
    const directCardTitleUses = collectCardTitleUses(productionSources);
    const directUseKeys = new Set(
      directCardTitleUses.map(({ literalKey }) => literalKey),
    );
    const allLiteralKeys = allCardTitleLiterals.map(getLiteralKey);
    const unresolvedLiterals = allCardTitleLiterals.filter(
      (literal) => !directUseKeys.has(getLiteralKey(literal)),
    );
    const unresolvedUses: CardTitleUse[] = unresolvedLiterals.map((literal) => ({
      path: literal.path,
      line: literal.line,
      className: null,
      literalKey: getLiteralKey(literal),
    }));
    const cardTitleUses = [...directCardTitleUses, ...unresolvedUses];

    expect(allCardTitleLiterals).toHaveLength(21);
    expect(cardTitleUses).toHaveLength(21);
    expect(directUseKeys).toEqual(new Set(allLiteralKeys));

    const violations = cardTitleUses
      .filter(
        ({ className }) =>
          className === null || !className.split(/\s+/).includes("inline"),
      )
      .map(({ path: sourcePath, line, className }) =>
        `${sourcePath}:${line} ${className ?? "<unresolved className>"}`,
      );

    expect(violations).toEqual([]);
  });
});
