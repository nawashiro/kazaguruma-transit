import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type {
  KeyLocation,
  KeyLocationCategory,
  KeyLocationsDataResult,
} from "../../../../utils/addressLoader";
import type * as TypeScript from "typescript";

// jest.setup.js mocks fs for API tests; use the real fs and TypeScript parser here.
jest.unmock("fs");
const ts: typeof import("typescript") = jest.requireActual("typescript");

const mockLoadKeyLocationsDataResult = jest.fn();

const primaryLocation: KeyLocation = {
  id: "kanda-library-日本",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  area: "神田",
  description: "地域の図書館です",
  descriptionCopyright: "千代田区オープンデータ",
  imageUri: "https://example.test/kanda-library.jpg",
  imageCopyright: "市民写真家",
  uri: "https://example.test/kanda-library",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const minimalLocation: KeyLocation = {
  id: "ogawamachi-hall",
  name: "小川町ホール",
  lat: 35.695,
  lng: 139.765,
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const chiyodaWardOfficeLocation: KeyLocation = {
  id: "5e3b1528-8af6-436a-83af-24ca45b58e12",
  name: "千代田区役所",
  lat: 35.694003,
  lng: 139.753595,
  area: "九段南",
  description: "千代田区役所です",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const alternateMetadataLocation: KeyLocation = {
  id: "metadata-contract-alternate-location",
  name: "千代田区立図書館",
  lat: 35.6941,
  lng: 139.7532,
  area: "九段南",
  description: "千代田区立図書館です",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const successCategories: KeyLocationCategory[] = [
  {
    category: "公共施設",
    "category:en": "public-facilities",
    locations: [primaryLocation, minimalLocation],
  },
];

function successData(
  categories: KeyLocationCategory[] = successCategories
): KeyLocationsDataResult {
  return { status: "success", categories };
}

function successDataForLocation(location: KeyLocation): KeyLocationsDataResult {
  return successData([
    {
      category: "公共施設",
      "category:en": "public-facilities",
      locations: [location],
    },
  ]);
}

function duplicateDataForLocation(location: KeyLocation): KeyLocationsDataResult {
  return successData([
    {
      category: "公共施設",
      "category:en": "public-facilities",
      locations: [location],
    },
    {
      category: "別カテゴリ",
      "category:en": "another-category",
      locations: [{ ...location, name: "同じIDの別施設" }],
    },
  ]);
}

jest.mock("@/utils/addressLoader", () => {
  const actual = jest.requireActual("@/utils/addressLoader");
  return {
    ...actual,
    loadKeyLocationsDataResult: mockLoadKeyLocationsDataResult,
  };
});

type PublicModule = Record<string, unknown>;
type LocationDetailPage = (props: {
  params: Promise<{ id: string }>;
}) => React.ReactNode | Promise<React.ReactNode>;

type LocationDetailMetadata = (props: {
  params: Promise<{ id: string }>;
}) => unknown | Promise<unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

function loadPageModule(): ModuleState {
  try {
    // Guarded runtime loading keeps the missing public route as a named RED.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded: unknown = require("../page");
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error("expected the route module to export an object"),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function getPageModule(): PublicModule {
  const state = loadPageModule();
  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(`location detail page is not implemented: ${detail}`);
  }
  if (!state.exports) {
    throw new Error("location detail page is not implemented: public module exported nothing");
  }
  return state.exports;
}

function getPage(): LocationDetailPage {
  const page = getPageModule().default;
  if (typeof page !== "function") {
    throw new Error(
      "location detail page is not implemented: public module does not export a default page"
    );
  }
  return page as LocationDetailPage;
}

function getGenerateMetadata(): LocationDetailMetadata {
  const generateMetadata = getPageModule().generateMetadata;
  expect(typeof generateMetadata).toBe("function");
  return generateMetadata as LocationDetailMetadata;
}

function loadLoadingModule(): ModuleState {
  try {
    // Guarded runtime loading keeps the missing public boundary as a named RED.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded: unknown = require("../loading");
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error("expected the loading boundary module to export an object"),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function getLoading(): () => React.ReactNode {
  const state = loadLoadingModule();
  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(`location detail loading boundary is not implemented: ${detail}`);
  }
  if (!state.exports) {
    throw new Error(
      "location detail loading boundary is not implemented: public module exported nothing"
    );
  }
  const loading = state.exports.default;
  if (typeof loading !== "function") {
    throw new Error(
      "location detail loading boundary is not implemented: public module does not export a default loading component"
    );
  }
  return loading as () => React.ReactNode;
}

async function renderLocationDetailPage(id: string) {
  const page = getPage();
  const element = await page({ params: Promise.resolve({ id }) });
  if (!React.isValidElement(element)) {
    throw new Error("location detail page did not render a public React element");
  }
  return render(<main id="main-content">{element}</main>);
}

function expectedDestinationHref(location: KeyLocation): string {
  return `/?destination=${encodeURIComponent(
    JSON.stringify({
      lat: location.lat,
      lng: location.lng,
      address: location.name,
    })
  )}`;
}

function getDefinitionListForHeading(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name });
  const definitionList = heading.parentElement?.querySelector("dl");

  if (!(definitionList instanceof HTMLElement)) {
    throw new Error(`expected ${name} to contain a definition list`);
  }

  return definitionList;
}

function getDefinition(list: HTMLElement, termLabel: string): HTMLElement {
  const term = Array.from(list.querySelectorAll("dt")).find(
    (candidate) => candidate.textContent?.trim() === termLabel
  );
  const definition = term?.nextElementSibling;

  if (!(definition instanceof HTMLElement) || definition.tagName !== "DD") {
    throw new Error(`expected ${termLabel} to be followed by a dd`);
  }

  return definition;
}

function expectNoSemanticCardPresentationAround(element: HTMLElement) {
  const semanticCardMarkers = ["card", "card-body"];
  let ancestor = element.parentElement;

  while (ancestor && ancestor !== document.body) {
    for (const className of semanticCardMarkers) {
      expect(ancestor.classList).not.toContain(className);
    }
    ancestor = ancestor.parentElement;
  }
}

function getRuntimeLocationDetailContentImports(
  sourceFile: TypeScript.SourceFile,
): TypeScript.ImportDeclaration[] {
  return sourceFile.statements.filter((statement): statement is TypeScript.ImportDeclaration => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      return false;
    }

    const importClause = statement.importClause;
    return (
      statement.moduleSpecifier.text === "@/components/features/LocationDetailContent" &&
      importClause !== undefined &&
      !importClause.isTypeOnly
    );
  });
}

function getLocationDetailPageSourceFile(): TypeScript.SourceFile {
  const pagePath = path.resolve(__dirname, "../page.tsx");
  const source = readFileSync(pagePath, "utf8");
  return ts.createSourceFile(
    pagePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function expectTopReturnLinkBeforeHeading(heading: HTMLElement) {
  const returnLinks = screen.getAllByRole("link", {
    name: "場所一覧に戻る",
  });

  expect(returnLinks).toHaveLength(1);
  expect(returnLinks[0].tagName).toBe("A");
  expect(returnLinks[0]).toHaveAttribute("href", "/locations");
  expect(returnLinks[0].compareDocumentPosition(heading)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING
  );
}

const nonSuccessStates = {
  notFound: {
    title: "場所が見つかりません",
    message: "指定された場所は見つかりませんでした。場所一覧から選び直してください。",
    marker: "指定された場所は見つかりませんでした",
  },
  dataLoadError: {
    title: "場所データを取得できません",
    message: "場所データの取得に失敗しました。時間をおいて再試行してください。",
    marker: "場所データの取得に失敗しました",
  },
  invalidId: {
    title: "場所詳細を表示できません",
    message: "場所識別子が不正です。場所一覧から選び直してください。",
    marker: "場所識別子が不正です",
  },
  duplicateId: {
    title: "場所詳細を表示できません",
    message: "場所識別子が重複しています。場所一覧から選び直してください。",
    marker: "場所識別子が重複しています",
  },
} as const;

type NonSuccessState = keyof typeof nonSuccessStates;

function expectNonSuccessState(state: NonSuccessState) {
  const { title, message, marker } = nonSuccessStates[state];
  const heading = screen.getByRole("heading", { level: 1, name: title });

  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  expect(heading).toBeVisible();
  expectTopReturnLinkBeforeHeading(heading);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();

  const errorHeading = screen.getByRole("heading", {
    level: 2,
    name: "エラー",
  });
  expect(errorHeading).toBeVisible();

  const body = screen.getByText(message, { exact: true });
  expect(body).toBeVisible();
  const errorPanel = body.closest(".alert");
  if (!(errorPanel instanceof HTMLElement)) {
    throw new Error("expected the location error body to be inside an alert panel");
  }
  expect(errorPanel).toHaveClass(
    "alert-error",
    "alert-soft",
    "text-base-content!"
  );

  const pageText = document.body.textContent ?? "";
  for (const otherState of Object.values(nonSuccessStates)) {
    if (otherState.marker === marker) {
      expect(pageText).toContain(otherState.marker);
    } else {
      expect(pageText).not.toContain(otherState.marker);
    }
  }

  expect(screen.queryByRole("link", { name: "ここへ行く" })).not.toBeInTheDocument();
  expect(screen.queryByText(primaryLocation.description ?? "")).not.toBeInTheDocument();
}

describe("/location-detail/[id] public route", () => {
  beforeEach(() => {
    mockLoadKeyLocationsDataResult.mockReset();
    mockLoadKeyLocationsDataResult.mockResolvedValue(successData());
  });

  it("returns the exact metadata title for the real Chiyoda Ward Office fixture", async () => {
    const routeId = chiyodaWardOfficeLocation.id;
    mockLoadKeyLocationsDataResult.mockResolvedValue(
      successDataForLocation(chiyodaWardOfficeLocation)
    );

    const metadata = (await getGenerateMetadata()({
      params: Promise.resolve({ id: routeId }),
    })) as { title?: string };

    expect(metadata.title).toBe("千代田区役所 - 場所詳細");
    expect(metadata.title).not.toContain(routeId);
  });

  it("uses the resolved location name for another valid metadata fixture", async () => {
    mockLoadKeyLocationsDataResult.mockResolvedValue(
      successDataForLocation(alternateMetadataLocation)
    );

    const metadata = (await getGenerateMetadata()({
      params: Promise.resolve({ id: alternateMetadataLocation.id }),
    })) as { title?: string };

    expect(metadata.title).toBe(`${alternateMetadataLocation.name} - 場所詳細`);
  });

  it.each([
    [
      "invalid ID",
      "invalid/id",
      () =>
        mockLoadKeyLocationsDataResult.mockResolvedValue(
          successDataForLocation(chiyodaWardOfficeLocation)
        ),
    ],
    [
      "unknown ID",
      "unknown-location",
      () =>
        mockLoadKeyLocationsDataResult.mockResolvedValue(
          successDataForLocation(chiyodaWardOfficeLocation)
        ),
    ],
    [
      "duplicate ID",
      chiyodaWardOfficeLocation.id,
      () =>
        mockLoadKeyLocationsDataResult.mockResolvedValue(
          duplicateDataForLocation(chiyodaWardOfficeLocation)
        ),
    ],
    [
      "data-load error",
      chiyodaWardOfficeLocation.id,
      () =>
        mockLoadKeyLocationsDataResult.mockResolvedValue({
          status: "error" as const,
          error: new Error("HTTP 503"),
        }),
    ],
    [
      "transport error",
      chiyodaWardOfficeLocation.id,
      () =>
        mockLoadKeyLocationsDataResult.mockRejectedValue(
          new Error("network unavailable")
        ),
    ],
  ])(
    "returns the exact fallback metadata title for %s",
    async (_label, routeId, configureLoader) => {
      configureLoader();

      await expect(
        getGenerateMetadata()({
          params: Promise.resolve({ id: routeId }),
        })
      ).resolves.toHaveProperty(
        "title",
        "場所詳細 | 風ぐるま乗換案内"
      );
    }
  );

  it("keeps metadata and page rendering on the same public ID/data boundary", async () => {
    const location = alternateMetadataLocation;
    mockLoadKeyLocationsDataResult.mockResolvedValue(successDataForLocation(location));

    const metadata = (await getGenerateMetadata()({
      params: Promise.resolve({ id: location.id }),
    })) as { title?: string };

    await renderLocationDetailPage(location.id);

    expect(metadata.title).toBe(`${location.name} - 場所詳細`);
    expect(
      screen.getByRole("heading", { level: 1, name: location.name })
    ).toBeInTheDocument();
  });

  it("places exactly one locations link before the detail heading", async () => {
    await renderLocationDetailPage(primaryLocation.id);

    const locationsLinks = screen.getAllByRole("link", {
      name: /^場所一覧に戻る$/,
    });
    const heading = screen.getByRole("heading", {
      level: 1,
      name: /^神田図書館$/,
    });

    expect(locationsLinks).toHaveLength(1);
    expect(locationsLinks[0]).toHaveAttribute("href", "/locations");
    expect(locationsLinks[0].compareDocumentPosition(heading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("renders complete location details and the destination CTA through the real public page boundary", async () => {
    mockLoadKeyLocationsDataResult.mockResolvedValue(
      successDataForLocation(primaryLocation)
    );

    const { container } = await renderLocationDetailPage(primaryLocation.id);
    const primaryArea = typeof primaryLocation.area === "string" ? primaryLocation.area : "";

    expect(
      screen.getByRole("heading", { level: 1, name: primaryLocation.name })
    ).toBeInTheDocument();
    expect(screen.getByText(primaryArea)).toBeInTheDocument();
    expect(screen.getByText(primaryLocation.description ?? "")).toBeInTheDocument();

    const areaTerm = screen.getByText("地域", { selector: "dt" });
    expect(areaTerm.closest("dl")).not.toBeNull();
    expect(areaTerm.nextElementSibling?.tagName).toBe("DD");
    expect(areaTerm.nextElementSibling).toHaveTextContent(primaryArea);

    const imageElements = container.querySelectorAll("img");
    expect(imageElements).toHaveLength(1);
    expect(imageElements[0]).toHaveAttribute("src", primaryLocation.imageUri);
    expect(imageElements[0]).toHaveAttribute("alt", "");
    expect(imageElements[0]).not.toHaveAttribute("role");

    const imageFrame = container.querySelector("figure");
    if (!(imageFrame instanceof HTMLElement)) {
      throw new Error("expected the location image to have a figure frame");
    }
    expect(imageFrame).toHaveClass("aspect-[4/3]");

    expect(screen.getByRole("link", { name: "ウェブサイトを見る" })).toHaveAttribute(
      "href",
      primaryLocation.uri
    );

    const destinationLink = screen.getByRole("link", { name: "ここへ行く" });
    expect(destinationLink.tagName).toBe("A");
    expect(destinationLink).toHaveClass("btn", "text-base");
    expect(destinationLink).toHaveClass("inline-flex");
    expect(destinationLink).toHaveClass("dark:text-white");
    expect(destinationLink).toHaveAttribute(
      "href",
      expectedDestinationHref(primaryLocation)
    );
    expect(screen.queryByRole("button", { name: "ここへ行く" })).not.toBeInTheDocument();

    const infoHeading = screen.getByRole("heading", { level: 2, name: "提供" });
    const infoList = getDefinitionListForHeading("提供");
    const infoTerms = Array.from(infoList.querySelectorAll("dt"));
    const infoDefinitions = Array.from(infoList.querySelectorAll("dd"));

    expect(infoTerms).toHaveLength(4);
    expect(infoDefinitions).toHaveLength(4);
    for (const term of infoTerms) {
      expect(term.nextElementSibling?.tagName).toBe("DD");
    }
    expect(getDefinition(infoList, "座標データ提供")).toHaveTextContent(
      primaryLocation.nodeCopyright
    );
    expect(getDefinition(infoList, "画像提供")).toHaveTextContent(
      primaryLocation.imageCopyright ?? ""
    );
    expect(getDefinition(infoList, "説明文提供")).toHaveTextContent(
      primaryLocation.descriptionCopyright ?? ""
    );
    expect(getDefinition(infoList, "ライセンス").querySelector("a")).toHaveAttribute(
      "href",
      primaryLocation.licenceUri
    );
    expectNoSemanticCardPresentationAround(infoHeading);
    expect(
      infoHeading.compareDocumentPosition(destinationLink) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("omits optional detail fields through the real public page boundary", async () => {
    const optionalOmissionLocation: KeyLocation = {
      ...minimalLocation,
      description: "",
    };
    mockLoadKeyLocationsDataResult.mockResolvedValue(
      successDataForLocation(optionalOmissionLocation)
    );

    const { container } = await renderLocationDetailPage(optionalOmissionLocation.id);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: optionalOmissionLocation.name,
      })
    ).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: "ウェブサイトを見る" })).not.toBeInTheDocument();
    expect(screen.queryByText("画像提供", { selector: "dt" })).not.toBeInTheDocument();
    expect(screen.queryByText("説明文提供", { selector: "dt" })).not.toBeInTheDocument();

    const infoList = getDefinitionListForHeading("提供");
    const infoTerms = Array.from(infoList.querySelectorAll("dt"));
    expect(infoTerms.map((term) => term.textContent?.trim())).toEqual([
      "座標データ提供",
      "ライセンス",
    ]);
    expect(infoList.querySelectorAll("dd")).toHaveLength(2);
    for (const term of infoTerms) {
      expect(term.nextElementSibling?.tagName).toBe("DD");
    }
    expect(getDefinition(infoList, "座標データ提供")).toHaveTextContent(
      optionalOmissionLocation.nodeCopyright
    );
    expect(
      getDefinition(infoList, "ライセンス").querySelector("a")
    ).toHaveAttribute("href", optionalOmissionLocation.licenceUri);

    const destinationLink = screen.getByRole("link", { name: "ここへ行く" });
    expect(destinationLink.tagName).toBe("A");
    expect(destinationLink).toHaveAttribute(
      "href",
      expectedDestinationHref(optionalOmissionLocation)
    );
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "提供",
      }).compareDocumentPosition(destinationLink) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("removes the LocationDetailContent runtime import from the page boundary", () => {
    const runtimeImports = getRuntimeLocationDetailContentImports(
      getLocationDetailPageSourceFile()
    );

    expect(runtimeImports).toHaveLength(0);
  });

  it("renders a Japanese not-found state with its top return link", async () => {
    mockLoadKeyLocationsDataResult.mockResolvedValue(successData([]));

    await renderLocationDetailPage("unknown-location");

    expectNonSuccessState("notFound");
  });

  it("renders a distinct Japanese duplicate-ID error state with its top return link", async () => {
    const duplicateLocation = { ...primaryLocation, name: "同じIDの別施設" };
    mockLoadKeyLocationsDataResult.mockResolvedValue(
      successData([
        successCategories[0],
        {
          category: "別カテゴリ",
          "category:en": "another-category",
          locations: [duplicateLocation],
        },
      ])
    );

    await renderLocationDetailPage(primaryLocation.id);

    expectNonSuccessState("duplicateId");
  });

  it("renders a distinct Japanese invalid-ID error state with its top return link", async () => {
    await renderLocationDetailPage("invalid/id");

    expectNonSuccessState("invalidId");
  });

  it("renders a data-load-error state distinct from not-found with its top return link", async () => {
    mockLoadKeyLocationsDataResult.mockResolvedValue({
      status: "error",
      error: new Error("HTTP 503"),
    });

    await renderLocationDetailPage(primaryLocation.id);

    expectNonSuccessState("dataLoadError");
  });

  it("exposes a loading route state with a top return link and Japanese progress message", () => {
    const loading = getLoading();
    const element = loading();
    if (!React.isValidElement(element)) {
      throw new Error("location detail page loading boundary did not render a public element");
    }
    render(element);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expectTopReturnLinkBeforeHeading(heading);
    expect(screen.getByText(/読み込み中|ロード中/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ここへ行く" })).not.toBeInTheDocument();
  });
});
