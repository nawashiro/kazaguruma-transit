import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type * as TypeScript from "typescript";

jest.unmock("fs");
const ts: typeof import("typescript") = jest.requireActual("typescript");

const ADDRESS_LOADER_SOURCE = "src/utils/addressLoader.ts";
const LOCATION_ORIGIN_QUERY_SOURCE = "src/lib/location/location-origin-query.ts";
const LOCATION_CARD_MODULE = "src/components/features/LocationCard.tsx";
const LOCATION_DETAIL_LOADING_MODULE = "src/components/features/LocationDetailLoading.tsx";

type ProductionExportName = string;

function productionPath(sourcePath: string): string {
  return path.resolve(process.cwd(), sourcePath);
}

function sourceFileFor(sourcePath: string): TypeScript.SourceFile {
  const absolutePath = productionPath(sourcePath);
  return ts.createSourceFile(
    sourcePath,
    readFileSync(absolutePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function hasExportModifier(node: TypeScript.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;

  return (
    ts.getModifiers(node)?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ) ?? false
  );
}

function exportedNames(sourcePath: string): ProductionExportName[] {
  const sourceFile = sourceFileFor(sourcePath);
  const names: ProductionExportName[] = [];

  function visit(node: TypeScript.Node): void {
    if (hasExportModifier(node)) {
      if (
        (ts.isClassDeclaration(node) ||
          ts.isEnumDeclaration(node) ||
          ts.isFunctionDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node)) &&
        node.name
      ) {
        names.push(node.name.text);
      } else if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            names.push(declaration.name.text);
          }
        }
      }
    }

    if (
      ts.isExportDeclaration(node) &&
      node.exportClause &&
      ts.isNamedExports(node.exportClause)
    ) {
      for (const element of node.exportClause.elements) {
        names.push(element.name.text);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return names;
}

describe("Spec023 T053A unused production candidate boundaries", () => {
  it("removes legacy loadAddressData while retaining loadAddressDataResult", () => {
    const names = exportedNames(ADDRESS_LOADER_SOURCE);

    expect(names).toContain("loadAddressDataResult");
    expect(names).not.toContain("loadAddressData");
  });

  it("removes the unused LocationCard production module", () => {
    expect(existsSync(productionPath(LOCATION_CARD_MODULE))).toBe(false);
  });

  it("removes the unused LocationDetailLoading production module", () => {
    expect(existsSync(productionPath(LOCATION_DETAIL_LOADING_MODULE))).toBe(false);
  });

  it("removes legacy location-link exports while retaining origin parsing and serialization", () => {
    const names = exportedNames(LOCATION_ORIGIN_QUERY_SOURCE);
    const removedNames = ["LocationLinkKind", "buildLocationHref"].filter((name) =>
      names.includes(name),
    );

    expect(names).toEqual(
      expect.arrayContaining(["parseLocationOrigin", "serializeLocationOrigin"]),
    );
    expect(removedNames).toEqual([]);
  });
});
