import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import type * as TypeScript from "typescript";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ApprovalStatusTabs } from "@/components/discussion/ApprovalStatusTabs";

jest.unmock("fs");
const ts: typeof import("typescript") = jest.requireActual("typescript");

const GLOBAL_STYLES_PATH = "src/app/globals.css";
const BADGE_PRODUCTION_FILES = [
  "src/app/discussions/[naddr]/approve/page.tsx",
  "src/app/discussions/[naddr]/page.tsx",
  "src/app/discussions/manage/page.tsx",
  "src/app/discussions/page.tsx",
  "src/app/license/page.tsx",
  "src/components/discussion/ApprovalStatusTabs.tsx",
  "src/components/discussion/EvaluationComponent.tsx",
  "src/components/discussion/PostPreview.tsx",
  "src/components/features/IntegratedRouteDisplay.tsx",
  "src/components/features/StopTimeDisplay.tsx",
] as const;

const EXPECTED_GLOBAL_FONT_SELECTORS = [
  "a",
  "body",
  "code",
  "dd",
  "dt",
  "li",
  "p",
  "td",
  "th",
];

type CssRule = {
  selector: string;
  body: string;
};

type BadgeUsage = {
  path: string;
  line: number;
  source: string;
  isStatic: boolean;
  staticClasses: string[];
};

function readSource(sourcePath: string): string {
  return readFileSync(path.resolve(process.cwd(), sourcePath), "utf8");
}

function removeCssComments(styles: string): string {
  return styles.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
    comment.replace(/[^\n]/g, " "),
  );
}

function extractTopLevelCssRules(styles: string): CssRule[] {
  const content = removeCssComments(styles);
  const rules: CssRule[] = [];
  let braceDepth = 0;
  let blockStart = 0;
  let topLevelRule: { selector: string; bodyStart: number } | null = null;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (quote !== null) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === "{") {
      if (braceDepth === 0) {
        topLevelRule = {
          selector: content.slice(blockStart, index).trim(),
          bodyStart: index + 1,
        };
      }
      braceDepth += 1;
      continue;
    }

    if (character !== "}") continue;

    if (braceDepth === 0) continue;
    braceDepth -= 1;

    if (braceDepth === 0 && topLevelRule !== null) {
      rules.push({
        selector: topLevelRule.selector,
        body: content.slice(topLevelRule.bodyStart, index),
      });
      topLevelRule = null;
      blockStart = index + 1;
    }
  }

  return rules;
}

function splitSelectorList(selectorList: string): string[] {
  const selectors: string[] = [];
  let segment = "";
  let parenthesisDepth = 0;
  let bracketDepth = 0;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const character of selectorList) {
    if (quote !== null) {
      segment += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      segment += character;
      continue;
    }

    if (character === "(") parenthesisDepth += 1;
    if (character === ")" && parenthesisDepth > 0) parenthesisDepth -= 1;
    if (character === "[") bracketDepth += 1;
    if (character === "]" && bracketDepth > 0) bracketDepth -= 1;

    if (character === "," && parenthesisDepth === 0 && bracketDepth === 0) {
      selectors.push(segment.replace(/\s+/g, " ").trim());
      segment = "";
      continue;
    }

    segment += character;
  }

  const finalSelector = segment.replace(/\s+/g, " ").trim();
  if (finalSelector) selectors.push(finalSelector);
  return selectors;
}

function sourceFileFor(sourcePath: string): TypeScript.SourceFile {
  return ts.createSourceFile(
    sourcePath,
    readSource(sourcePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function extractBadgeUsages(sourcePath: string): BadgeUsage[] {
  const sourceFile = sourceFileFor(sourcePath);
  const usages: BadgeUsage[] = [];

  function visit(node: TypeScript.Node): void {
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "className" &&
      node.initializer
    ) {
      const initializer = node.initializer;
      const expression = ts.isJsxExpression(initializer)
        ? initializer.expression
        : initializer;
      const source = initializer.getText(sourceFile);
      const staticValue =
        expression && ts.isStringLiteralLike(expression) ? expression.text : null;
      const staticClasses = staticValue?.split(/\s+/).filter(Boolean) ?? [];

      if (staticClasses.includes("badge")) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        usages.push({
          path: sourcePath,
          line,
          source,
          isStatic: true,
          staticClasses,
        });
      } else if (expression && source.includes("badge")) {
        const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        usages.push({
          path: sourcePath,
          line,
          source,
          isStatic: false,
          staticClasses,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return usages;
}

function approvalStatusTabsProps(badgeClassName?: string) {
  return {
    activeTab: "pending" as const,
    approvedCount: 1,
    badgeClassName,
    idPrefix: "style-contract",
    onTabChange: jest.fn(),
    pendingCount: 1,
  };
}

describe("Issue #83 Slice C style contracts", () => {
  it("limits the global 16px rule to the required elements and includes code instead of span", () => {
    const rules = extractTopLevelCssRules(readSource(GLOBAL_STYLES_PATH));
    const globalFontRule = rules.find((rule) =>
      splitSelectorList(rule.selector).includes("body") &&
      /(?:^|;)\s*font-size\s*:\s*([^;]+)/.test(rule.body),
    );

    expect(globalFontRule).toBeDefined();
    if (!globalFontRule) throw new Error("global 16px font rule was not found");

    expect(splitSelectorList(globalFontRule.selector).sort()).toEqual(
      [...EXPECTED_GLOBAL_FONT_SELECTORS].sort(),
    );
    expect(globalFontRule.selector).not.toMatch(/(?:^|,)\s*span\s*(?:,|$)/);
    expect(globalFontRule.body.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/)?.[1].trim()).toBe(
      "16px",
    );
  });

  it("requires badge-md on every current production badge use", () => {
    const usages = BADGE_PRODUCTION_FILES.flatMap((sourcePath) =>
      extractBadgeUsages(sourcePath),
    );

    for (const sourcePath of BADGE_PRODUCTION_FILES) {
      expect(usages.filter((usage) => usage.path === sourcePath)).not.toHaveLength(0);
    }

    const staticMissingBadgeMd = usages
      .filter((usage) => usage.isStatic && !usage.staticClasses.includes("badge-md"))
      .map((usage) => `${usage.path}:${usage.line}: ${usage.source}`);
    expect(staticMissingBadgeMd).toEqual([]);

    const dynamicNonApprovalUsages = usages.filter(
      (usage) => !usage.isStatic && !usage.path.endsWith("ApprovalStatusTabs.tsx"),
    );
    expect(dynamicNonApprovalUsages).toEqual([]);

    const approvalSource = readSource("src/components/discussion/ApprovalStatusTabs.tsx");
    const approvalDynamicUsages = usages.filter(
      (usage) => !usage.isStatic && usage.path.endsWith("ApprovalStatusTabs.tsx"),
    );
    if (approvalDynamicUsages.length > 0) {
      expect(approvalSource).toContain("badge-md");
      expect(approvalDynamicUsages.every((usage) => usage.source.includes("badgeSizeClassName"))).toBe(
        true,
      );
    }
  });

  it.each([
    ["default", undefined],
    ["explicit badge-md prop", "badge-md"],
  ])("keeps ApprovalStatusTabs %s badges explicitly at badge-md", (_path, badgeClassName) => {
    const { container } = render(
      createElement(ApprovalStatusTabs, approvalStatusTabsProps(badgeClassName)),
    );

    const badges = [...container.querySelectorAll<HTMLElement>(".badge")];
    expect(badges).toHaveLength(2);
    expect(badges.every((badge) => badge.classList.contains("badge-md"))).toBe(true);
  });
});
