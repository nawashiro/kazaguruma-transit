import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type * as TypeScript from "typescript";
import type {
  KeyLocation,
  KeyLocationCategory,
  KeyLocationsDataResult,
} from "../../../utils/addressLoader";

jest.unmock("fs");
const ts: typeof import("typescript") = jest.requireActual("typescript");

const mockRedirect = jest.fn();
const mockNotFound = jest.fn();
const mockLoadLocationPageData = jest.fn();
const mockLoadLocationCategories = jest.fn();
const mockLoadKeyLocationsData = jest.fn();

jest.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  notFound: () => mockNotFound(),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("@/lib/location/location-page-data", () => ({
  loadLocationPageData: (...args: unknown[]) =>
    mockLoadLocationPageData(...args),
}));

jest.mock("@/lib/location/location-list-state", () => {
  const actual = jest.requireActual("@/lib/location/location-list-state");
  return {
    ...actual,
    loadLocationCategories: (...args: unknown[]) =>
      mockLoadLocationCategories(...args),
  };
});

jest.mock("@/utils/addressLoader", () => {
  const actual = jest.requireActual("@/utils/addressLoader");
  return {
    ...actual,
    loadKeyLocationsData: (...args: unknown[]) =>
      mockLoadKeyLocationsData(...args),
  };
});

const LOCATION_PRODUCTION_ROOT = "src/app/locations";
const LOCATION_PAGE_SUPPORT_PRODUCTION_FILES = [
  "src/lib/location/location-list-state.ts",
] as const;
const RATE_LIMIT_PRODUCTION_FILES = [
  "src/types/access-route-pages.ts",
  "src/lib/navigation/rate-limit-source.ts",
] as const;
const PRODUCTION_DIRECTORY_EXCLUSIONS = new Set([
  ".next",
  "__mocks__",
  "__tests__",
  "fixtures",
]);
const SEARCH_CONTROL_TAGS = new Set(["form", "input", "textarea", "button"]);
const NAME_ADDRESS_SEARCH_PATTERN =
  /住所|場所名|検索|location[-_ ]?(?:address|name)|(?:address|name)[-_ ]?(?:search|input)|geocode/i;
const LOCATION_PAGE_FORBIDDEN_IDENTIFIERS = new Set([
  "geocodeAddress",
  "handleAddressSearch",
  "searchLoading",
  "searchError",
  "setAddress",
  "setSearchLoading",
  "setSearchError",
]);
const LOCATION_PAGE_FORBIDDEN_STRING_PARTS = ["/api/geocode", "source=locations"];

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

function readProductionSource(filePath: string): ProductionSource {
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
}

function readLocationPageProductionSources(): ProductionSource[] {
  const paths = [
    ...collectProductionPaths(path.resolve(process.cwd(), LOCATION_PRODUCTION_ROOT)),
    ...LOCATION_PAGE_SUPPORT_PRODUCTION_FILES.map((sourcePath) =>
      path.resolve(process.cwd(), sourcePath),
    ),
  ].sort();
  if (paths.length === 0) {
    throw new Error("T041 RED setup failure: locations production sources were not found");
  }
  return paths.map(readProductionSource);
}

function readRateLimitProductionSources(): ProductionSource[] {
  return RATE_LIMIT_PRODUCTION_FILES.map((sourcePath) =>
    readProductionSource(path.resolve(process.cwd(), sourcePath)),
  );
}

function lineNumber(sourceFile: TypeScript.SourceFile, node: TypeScript.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function jsxTagName(
  node: TypeScript.JsxElement | TypeScript.JsxSelfClosingElement,
  sourceFile: TypeScript.SourceFile,
): string {
  const openingElement = ts.isJsxElement(node) ? node.openingElement : node;
  return openingElement.tagName.getText(sourceFile);
}

function literalText(node: TypeScript.Node): string | null {
  if (
    ts.isStringLiteralLike(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    return node.text;
  }
  return null;
}

function collectLocationPageNegativeViolations(): string[] {
  const violations: string[] = [];

  for (const { path: sourcePath, sourceFile } of readLocationPageProductionSources()) {
    function visit(node: TypeScript.Node): void {
      if (ts.isIdentifier(node) && LOCATION_PAGE_FORBIDDEN_IDENTIFIERS.has(node.text)) {
        violations.push(
          `${sourcePath}:${lineNumber(sourceFile, node)} obsolete location-page identifier ${node.text}`,
        );
      }

      const sourceLiteral = literalText(node);
      if (
        sourceLiteral !== null &&
        LOCATION_PAGE_FORBIDDEN_STRING_PARTS.some((part) => sourceLiteral.includes(part))
      ) {
        violations.push(
          `${sourcePath}:${lineNumber(sourceFile, node)} obsolete location-page string ${sourceLiteral}`,
        );
      }

      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tagName = jsxTagName(node, sourceFile);
        const isSearchControl =
          SEARCH_CONTROL_TAGS.has(tagName.toLowerCase()) ||
          /(?:search|address|geocode)/i.test(tagName);
        if (isSearchControl && NAME_ADDRESS_SEARCH_PATTERN.test(node.getText(sourceFile))) {
          violations.push(
            `${sourcePath}:${lineNumber(sourceFile, node)} name/address search control ${tagName}`,
          );
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return violations;
}

function collectLocationRateLimitBranchViolations(): string[] {
  const violations: string[] = [];

  for (const { path: sourcePath, sourceFile } of readRateLimitProductionSources()) {
    function visit(node: TypeScript.Node): void {
      const isSourceType = sourcePath === "src/types/access-route-pages.ts";
      const isRateLimitSource = sourcePath === "src/lib/navigation/rate-limit-source.ts";
      if (
        (isSourceType || isRateLimitSource) &&
        ((ts.isIdentifier(node) && node.text === "locations") ||
          (ts.isStringLiteralLike(node) && node.text === "locations"))
      ) {
        violations.push(
          `${sourcePath}:${lineNumber(sourceFile, node)} locations-specific rate-limit branch`,
        );
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return violations;
}

type PublicPage = () => React.ReactNode | Promise<React.ReactNode>;
type PublicPageModule = { default?: unknown };

const locationFixture: KeyLocation = {
  id: "kanda-library-日本",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  area: "千代田",
  description: "地域の図書館です",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const firstCategoryFixture: KeyLocationCategory = {
  category: "区役所・出張所",
  "category:en": "city office/branch offices",
  locations: [locationFixture],
};

const secondCategoryFixture: KeyLocationCategory = {
  category: "公共施設",
  "category:en": "public-facilities",
  locations: [{ ...locationFixture, id: "public-library-日本" }],
};

const locationCategoriesFixture: KeyLocationCategory[] = [
  firstCategoryFixture,
  secondCategoryFixture,
];

function successData(
  categories: KeyLocationCategory[] = locationCategoriesFixture,
): KeyLocationsDataResult {
  return { status: "success", categories };
}

function getPublicPage(): PublicPage {
  let loaded: unknown;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("../page") as PublicPageModule;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`locations entry page is not implemented: ${detail}`);
  }

  if (typeof loaded !== "object" || loaded === null) {
    throw new Error("locations entry page is not implemented: module exported nothing");
  }

  const page = (loaded as PublicPageModule).default;
  if (typeof page !== "function") {
    throw new Error(
      "locations entry page is not implemented: public module does not export a default page",
    );
  }

  return page as PublicPage;
}

function isLegacyClientInvocation(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Invalid hook call|reading ['\"]use(State|Effect|Callback)['\"]/.test(error.message)
  );
}

async function invokePublicPage() {
  const page = getPublicPage();
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  try {
    const element = await page();
    if (React.isValidElement(element)) {
      return render(<main id="main-content">{element}</main>);
    }

    return undefined;
  } catch (error) {
    if (!isLegacyClientInvocation(error)) {
      throw error;
    }

    // The old page is a client component and cannot be called as a server
    // entry. Rendering it here keeps the intended RED an assertion failure.
    return render(
      <main id="main-content">{React.createElement(page as React.ComponentType)}</main>,
    );
  } finally {
    consoleError.mockRestore();
  }
}

function expectNoLocationNotFoundGuidance() {
  expect(
    screen.queryByRole("heading", {
      level: 1,
      name: /見つかりません/,
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/指定されたカテゴリ|カテゴリ一覧から選び直してください|場所一覧から選び直してください/),
  ).not.toBeInTheDocument();
}

function expectLocationDataErrorBoundary() {
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: /場所データ|施設データ/,
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(/取得|読み込み|不正|失敗/)).toBeInTheDocument();
  expectNoLocationNotFoundGuidance();
}

function expectNoLegacyLocationLoaderCalls(): void {
  expect(mockLoadLocationCategories).not.toHaveBeenCalled();
  expect(mockLoadKeyLocationsData).not.toHaveBeenCalled();
}

describe("/locations server entry", () => {
  beforeEach(() => {
    mockRedirect.mockReset();
    mockNotFound.mockReset();
    mockLoadLocationPageData.mockReset();
    mockLoadLocationCategories.mockReset();
    mockLoadLocationCategories.mockResolvedValue(locationCategoriesFixture);
    mockLoadKeyLocationsData.mockReset();
    mockLoadKeyLocationsData.mockResolvedValue(locationCategoriesFixture);
  });

  it("成功データの決定的な先頭category:enをエンコードしたカテゴリURLへ解決する", async () => {
    mockLoadLocationPageData.mockResolvedValue(successData());

    await invokePublicPage();

    expect(mockLoadLocationPageData).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith(
      `/locations/${encodeURIComponent(firstCategoryFixture["category:en"])}`,
    );
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it("uses the public location-page data boundary without invoking legacy location loaders", async () => {
    mockLoadLocationPageData.mockResolvedValue(successData());

    await invokePublicPage();

    expect(mockLoadLocationPageData).toHaveBeenCalledTimes(1);
    expectNoLegacyLocationLoaderCalls();
  });

  it("カテゴリ0件を空成功やカテゴリredirectにせずdata-error境界で扱う", async () => {
    mockLoadLocationPageData.mockResolvedValue(successData([]));

    await invokePublicPage();

    expect(mockLoadLocationPageData).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
    expectLocationDataErrorBoundary();
  });

  it("loader errorをカテゴリredirectや場所ページ固有404案内に変換しない", async () => {
    mockLoadLocationPageData.mockResolvedValue({
      status: "error",
      error: new Error("HTTP 503"),
    } satisfies KeyLocationsDataResult);

    await invokePublicPage();

    expect(mockLoadLocationPageData).toHaveBeenCalledTimes(1);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockNotFound).not.toHaveBeenCalled();
    expectLocationDataErrorBoundary();
  });
});

describe("T041 location-page obsolete negative contracts", () => {
  it("does not retain name/address search, location geocoding, or locations rate-limit support", () => {
    const violations = [
      ...collectLocationPageNegativeViolations(),
      ...collectLocationRateLimitBranchViolations(),
    ];

    expect(violations).toEqual([]);
  });
});
