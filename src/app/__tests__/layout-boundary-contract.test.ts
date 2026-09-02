import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type * as TypeScript from "typescript";

jest.unmock("fs");
const ts: typeof import("typescript") = jest.requireActual("typescript");

const PRODUCTION_ROOTS = ["src/app", "src/components"];

type SourceRecord = {
  path: string;
  sourceFile: TypeScript.SourceFile;
};

function collectProductionPaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") return [];
      return collectProductionPaths(entryPath);
    }
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) return [];
    if (entry.name.endsWith(".test.tsx") || entry.name.endsWith(".spec.tsx")) {
      return [];
    }
    return [entryPath];
  });
}

function getAttribute(
  element: TypeScript.JsxElement,
  name: string,
): TypeScript.JsxAttribute | undefined {
  return element.openingElement.attributes.properties.find(
    (property): property is TypeScript.JsxAttribute =>
      ts.isJsxAttribute(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === name,
  );
}

function getAttributeText(
  element: TypeScript.JsxElement,
  name: string,
  sourceFile: TypeScript.SourceFile,
): string {
  const attribute = getAttribute(element, name);
  if (!attribute?.initializer) return "";
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (ts.isJsxExpression(attribute.initializer)) {
    return attribute.initializer.expression?.getText(sourceFile) ?? "";
  }
  return "";
}

function hasTextExpression(expression: TypeScript.Expression | undefined): boolean {
  if (!expression) return false;
  let containsJsx = false;
  function visit(node: TypeScript.Node): void {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)) {
      containsJsx = true;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(expression);
  return !containsJsx;
}

function getDirectTextChildren(
  element: TypeScript.JsxElement,
  sourceFile: TypeScript.SourceFile,
): string[] {
  return element.children.flatMap((child) => {
    if (ts.isJsxText(child)) {
      const text = child.getText(sourceFile).replace(/\s+/g, " ").trim();
      return text ? [text] : [];
    }
    if (ts.isJsxExpression(child) && hasTextExpression(child.expression)) {
      const expression = child.expression?.getText(sourceFile).replace(/\s+/g, " ").trim();
      return expression ? [`{${expression}}`] : [];
    }
    return [];
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

function lineNumber(sourceFile: TypeScript.SourceFile, node: TypeScript.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

describe("Issue #106 layout boundary contract", () => {
  it("DaisyUI gridのalert/statusコンテナに直接テキストを置かない", () => {
    const violations: string[] = [];

    for (const { path: sourcePath, sourceFile } of readProductionSources()) {
      function visit(node: TypeScript.Node): void {
        if (ts.isJsxElement(node)) {
          const tagName = node.openingElement.tagName.getText(sourceFile);
          const className = getAttributeText(node, "className", sourceFile);
          const role = getAttributeText(node, "role", sourceFile).replace(/["']/g, "");
          const isAlert = className.split(/\s+/).includes("alert");
          const isStatus = role === "status";
          const isSemanticMessage = tagName === "p";
          if ((isAlert || isStatus) && !isSemanticMessage) {
            for (const text of getDirectTextChildren(node, sourceFile)) {
              violations.push(`${sourcePath}:${lineNumber(sourceFile, node)} ${text}`);
            }
          }
          ts.forEachChild(node, visit);
          return;
        }
        ts.forEachChild(node, visit);
      }
      visit(sourceFile);
    }

    expect(violations).toEqual([]);
  });

  it("Sidebarのmenu項目が単一のRubyfulラベルwrapperを持つ", () => {
    const sidebar = readProductionSources().find(
      ({ path: sourcePath }) => sourcePath === "src/components/layouts/Sidebar.tsx",
    );
    if (!sidebar) throw new Error("Sidebar.tsx was not found");
    const sidebarSource = sidebar;

    const violations: string[] = [];
    let menuItemCount = 0;
    const ancestors: string[] = [];

    function visit(node: TypeScript.Node): void {
      if (ts.isJsxElement(node)) {
        const tagName = node.openingElement.tagName.getText(sidebarSource.sourceFile);
        const className = getAttributeText(node, "className", sidebarSource.sourceFile);
        const isMenuItem =
          ancestors.includes("menu") && ["Link", "a", "summary"].includes(tagName);
        if (isMenuItem) {
          menuItemCount += 1;
          const labelWrappers = node.children.filter(
            (child): child is TypeScript.JsxElement =>
              ts.isJsxElement(child) &&
              child.openingElement.tagName.getText(sidebarSource.sourceFile) === "span" &&
              getAttributeText(child, "className", sidebarSource.sourceFile)
                .split(/\s+/)
                .includes("ruby-text"),
          );
          if (labelWrappers.length !== 1) {
            violations.push(
              `${sidebarSource.path}:${lineNumber(sidebarSource.sourceFile, node)} label-wrapper=${labelWrappers.length}`,
            );
          }
          if (className.split(/\s+/).includes("ruby-text")) {
            violations.push(
              `${sidebarSource.path}:${lineNumber(sidebarSource.sourceFile, node)} parent-ruby-text`,
            );
          }
        }
        ancestors.push(...className.split(/\s+/).filter(Boolean));
        ts.forEachChild(node, visit);
        ancestors.splice(ancestors.length - className.split(/\s+/).filter(Boolean).length);
        return;
      }
      ts.forEachChild(node, visit);
    }

    visit(sidebarSource.sourceFile);
    expect(menuItemCount).toBe(12);
    expect(violations).toEqual([]);
  });
});
