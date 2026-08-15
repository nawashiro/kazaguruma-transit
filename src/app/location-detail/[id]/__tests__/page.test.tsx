import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type {
  KeyLocation,
  KeyLocationCategory,
  KeyLocationsDataResult,
} from "../../../../utils/addressLoader";

const mockLoadKeyLocationsDataResult = jest.fn();
const mockRouterPush = jest.fn();

const primaryLocation: KeyLocation = {
  id: "kanda-library-日本",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  area: "神田",
  description: "地域の図書館です",
  imageUri: "https://example.test/kanda-library.jpg",
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

jest.mock("@/utils/addressLoader", () => {
  const actual = jest.requireActual("@/utils/addressLoader");
  return {
    ...actual,
    loadKeyLocationsDataResult: mockLoadKeyLocationsDataResult,
  };
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

type PublicModule = Record<string, unknown>;
type LocationDetailPage = (props: {
  params: Promise<{ id: string }>;
}) => React.ReactNode | Promise<React.ReactNode>;

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

function getMetadataTitle(metadata: unknown): string {
  if (typeof metadata !== "object" || metadata === null) return "";
  const title = (metadata as { title?: unknown }).title;
  if (typeof title === "string") return title;
  if (typeof title === "object" && title !== null) {
    const defaultTitle = (title as { default?: unknown }).default;
    if (typeof defaultTitle === "string") return defaultTitle;
  }
  return "";
}

describe("/location-detail/[id] public route", () => {
  beforeEach(() => {
    mockLoadKeyLocationsDataResult.mockReset();
    mockLoadKeyLocationsDataResult.mockResolvedValue(successData());
    mockRouterPush.mockReset();
  });

  it("exports a route-purpose metadata title", () => {
    const metadata = getPageModule().metadata;

    expect(metadata).toBeDefined();
    expect(getMetadataTitle(metadata)).toMatch(/場所|詳細/);
  });

  it("directly renders one host main and one h1 with complete location details", async () => {
    const view = await renderLocationDetailPage(primaryLocation.id);

    expect(view.container.querySelectorAll("main")).toHaveLength(1);
    expect(view.container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      primaryLocation.name
    );
    expect(screen.getByText(primaryLocation.description ?? "")).toBeInTheDocument();
    expect(screen.getByText("神田")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: primaryLocation.name })).toHaveAttribute(
      "src",
      primaryLocation.imageUri
    );
    expect(screen.getByText(/座標データ提供/)).toHaveTextContent(
      primaryLocation.nodeCopyright
    );
    expect(screen.getByRole("link", { name: "ウェブサイトを見る" })).toHaveAttribute(
      "href",
      primaryLocation.uri
    );
    expect(screen.getByRole("link", { name: primaryLocation.licence })).toHaveAttribute(
      "href",
      primaryLocation.licenceUri
    );
    expect(screen.getByRole("link", { name: /場所一覧|一覧に戻る/ })).toHaveAttribute(
      "href",
      "/locations"
    );

    fireEvent.click(screen.getByRole("button", { name: "ここへ行く" }));
    expect(mockRouterPush).toHaveBeenCalledWith(
      `/?destination=${encodeURIComponent(
        JSON.stringify({
          lat: primaryLocation.lat,
          lng: primaryLocation.lng,
          address: primaryLocation.name,
        })
      )}`
    );
  });

  it("renders a Japanese not-found state with a locations link for an unknown identifier", async () => {
    mockLoadKeyLocationsDataResult.mockResolvedValue(successData([]));

    await renderLocationDetailPage("unknown-location");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/見つかりません/);
    expect(screen.getByRole("link", { name: /場所一覧|一覧に戻る/ })).toHaveAttribute(
      "href",
      "/locations"
    );
    expect(screen.queryByRole("button", { name: "ここへ行く" })).not.toBeInTheDocument();
  });

  it("renders a distinct Japanese duplicate-ID error state", async () => {
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

    expect(screen.getByRole("alert")).toHaveTextContent(/重複/);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/見つかりません/);
    expect(screen.getByRole("link", { name: /場所一覧|一覧に戻る/ })).toHaveAttribute(
      "href",
      "/locations"
    );
  });

  it("renders a distinct Japanese invalid-ID error state", async () => {
    await renderLocationDetailPage("invalid/id");

    expect(screen.getByRole("alert")).toHaveTextContent(/不正/);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/見つかりません/);
    expect(screen.getByRole("link", { name: /場所一覧|一覧に戻る/ })).toHaveAttribute(
      "href",
      "/locations"
    );
  });

  it("renders a data-load-error state distinct from not-found", async () => {
    mockLoadKeyLocationsDataResult.mockResolvedValue({
      status: "error",
      error: new Error("HTTP 503"),
    });

    await renderLocationDetailPage(primaryLocation.id);

    expect(screen.getByRole("alert")).toHaveTextContent(/取得|読み込み|データ/);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/見つかりません/);
    expect(screen.getByRole("link", { name: /場所一覧|一覧に戻る/ })).toHaveAttribute(
      "href",
      "/locations"
    );
  });

  it("exposes a loading route state with a heading and Japanese progress message", () => {
    const loading = getLoading();
    const element = loading();
    if (!React.isValidElement(element)) {
      throw new Error("location detail page loading boundary did not render a public element");
    }
    render(element);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/場所|読み込み/);
    expect(screen.getByText(/読み込み中|ロード中/)).toBeInTheDocument();
  });
});
