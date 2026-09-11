import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type * as TypeScript from "typescript";
import { calculateDistance, sortLocationsByDistance } from "../location-list-state";

jest.unmock("fs");
const ts: typeof import("typescript") = jest.requireActual("typescript");

const PRODUCTION_ROOT = "src";
const PRODUCTION_DIRECTORY_EXCLUSIONS = new Set([
  ".next",
  "__mocks__",
  "__tests__",
  "fixtures",
]);
const OBSOLETE_LOCATION_IDENTIFIERS = new Set([
  "LocationListStatus",
  "LocationListOperation",
  "LocationListState",
  "LocationListAction",
  "GeocodingSuccess",
  "GeocodingFailure",
  "GeocodingResult",
  "createInitialLocationListState",
  "reduceLocationListState",
  "geocodeAddress",
  "loadLocationCategories",
  "groupCategoryLocationsByArea",
  "findLocationAreaName",
]);

type ProductionSource = {
  path: string;
  sourceFile: TypeScript.SourceFile;
};

function stripComments(sourceText: string): string {
  const characters = sourceText.split("");
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.JSX,
    sourceText,
  );
  let token = scanner.scan();

  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      for (let index = scanner.getTokenPos(); index < scanner.getTextPos(); index += 1) {
        if (characters[index] !== "\n" && characters[index] !== "\r") {
          characters[index] = " ";
        }
      }
    }
    token = scanner.scan();
  }

  return characters.join("");
}

function collectProductionPaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && PRODUCTION_DIRECTORY_EXCLUSIONS.has(entry.name)) {
      return [];
    }

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectProductionPaths(entryPath);
    }
    if (
      !entry.isFile() ||
      (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) ||
      entry.name.endsWith(".test.ts") ||
      entry.name.endsWith(".test.tsx") ||
      entry.name.endsWith(".spec.ts") ||
      entry.name.endsWith(".spec.tsx")
    ) {
      return [];
    }
    return [entryPath];
  });
}

function readProductionSources(): ProductionSource[] {
  const paths = collectProductionPaths(path.resolve(process.cwd(), PRODUCTION_ROOT)).sort();
  if (paths.length === 0) {
    throw new Error("T041 RED setup failure: production source files were not found");
  }

  return paths.map((filePath) => {
    const relativePath = path.relative(process.cwd(), filePath);
    const source = stripComments(readFileSync(filePath, "utf8"));
    return {
      path: relativePath,
      sourceFile: ts.createSourceFile(
        relativePath,
        source,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      ),
    };
  });
}

function lineNumber(sourceFile: TypeScript.SourceFile, node: TypeScript.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function collectObsoleteLocationStateViolations(): string[] {
  const violations: string[] = [];

  for (const { path: sourcePath, sourceFile } of readProductionSources()) {
    const isClientGeoUtils = sourcePath.endsWith("/clientGeoUtils.ts");

    function visit(node: TypeScript.Node): void {
      if (ts.isIdentifier(node) && OBSOLETE_LOCATION_IDENTIFIERS.has(node.text)) {
        violations.push(
          `${sourcePath}:${lineNumber(sourceFile, node)} obsolete location-list symbol ${node.text}`,
        );
      }

      if (
        ts.isStringLiteralLike(node) &&
        node.text.includes("clientGeoUtils") &&
        !isClientGeoUtils
      ) {
        violations.push(
          `${sourcePath}:${lineNumber(sourceFile, node)} clientGeoUtils production import`,
        );
      }

      if (
        isClientGeoUtils &&
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "fetch"
      ) {
        violations.push(
          `${sourcePath}:${lineNumber(sourceFile, node)} clientGeoUtils client fetch`,
        );
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return violations;
}

describe("location-list-state", () => {
  it("距離計算と距離順を共通処理として提供する", () => {
    expect(calculateDistance(35.68, 139.76, 35.69, 139.77)).toBeGreaterThan(0);
    expect(
      sortLocationsByDistance([
        { name: "遠い", lat: 0, lng: 0, distance: 2 },
        { name: "近い", lat: 0, lng: 0, distance: 1 },
      ])[0].name,
    ).toBe("近い");
  });

  it("production sourceから旧location state/geocodeとclient GeoJSON境界を除去する", () => {
    const violations = collectObsoleteLocationStateViolations();

    expect(violations).toEqual([]);
  });
});
