/* eslint-disable react/display-name */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "../page";
import type {
  LocationArtifact,
  LocationArtifactReadResult,
} from "@/lib/location/location-artifact";
import type {
  AddressCategory,
  AddressLocation,
} from "@/utils/addressLoader";

const mockRouterPush = jest.fn();
const mockReadLocationArtifact = jest.fn();
const mockDestinationSelectorProps = jest.fn();
const ANNOUNCEMENT_INFORMATION =
  "運行情報の更新";
const ANNOUNCEMENT_URL = "/service-update";

const popularFacility: AddressLocation = {
  name: "千代田区役所",
  lat: 35.694,
  lng: 139.753,
  copyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const successfulArtifact: LocationArtifact = {
  status: "validated",
  sourceUris: {
    mainFacilitiesUri: "https://fixtures.example.test/v2/main_facilities.json",
    keyLocationsUri: "https://fixtures.example.test/v2/key_locations.json",
    townGeoJsonUri: "https://fixtures.example.test/v2/chiyoda-towns.geojson",
  },
  sources: {
    mainFacilities: [
      {
        category: "公共施設",
        "category:en": "public-facilities",
        locations: [popularFacility],
      },
    ],
    keyLocations: [
      {
        category: "公共施設",
        "category:en": "public-facilities",
        locations: [
          {
            id: "kanda-library",
            name: "神田図書館",
            lat: 35.694,
            lng: 139.768,
            nodeCopyright: "千代田区",
            licence: "CC BY 4.0",
            licenceUri: "https://creativecommons.org/licenses/by/4.0/",
          },
        ],
      },
    ],
    townGeoJson: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "神田" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [139.7, 35.6],
                [139.8, 35.6],
                [139.8, 35.7],
                [139.7, 35.7],
                [139.7, 35.6],
              ],
            ],
          },
        },
      ],
    },
  },
  derivedRegions: {
    "kanda-library": "神田",
  },
};

const successfulArtifactResult: LocationArtifactReadResult = {
  status: "success",
  artifact: successfulArtifact,
};

const emptyPopularArtifact: LocationArtifact = {
  ...successfulArtifact,
  sources: {
    ...successfulArtifact.sources,
    mainFacilities: [],
  },
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock("@/lib/config/app-config", () => ({
  appConfig: {
    announcement: {
      information: "運行情報の更新",
      url: "/service-update",
    },
  },
}));

jest.mock("@/lib/location/location-artifact", () => ({
  readLocationArtifact: (...args: unknown[]) => mockReadLocationArtifact(...args),
}));

jest.mock("@/components/features/DateTimeSelector", () =>
  ({ onDateTimeSelected }: any) => (
    <button
      data-testid="mock-date-time-selector"
      onClick={() =>
        onDateTimeSelected({ dateTime: "2026-07-18T09:30", isDeparture: true })
      }
    />
  ),
);

jest.mock("@/components/features/OriginSelector", () =>
  ({ onOriginSelected }: any) => (
    <button
      data-testid="mock-origin-selector"
      onClick={() => onOriginSelected({ lat: 35.68, lng: 139.76, address: "テスト住所" })}
    />
  ),
);

jest.mock("@/components/features/DestinationSelector", () =>
  ({ onDestinationSelected, categories }: any) => {
    mockDestinationSelectorProps({ categories });

    return (
      <>
        <button
          data-testid="mock-destination-selector"
          onClick={() =>
            onDestinationSelected({ lat: 35.7, lng: 139.78, address: "テスト目的地" })
          }
        />
        {categories?.flatMap((category: AddressCategory) =>
          category.locations.map((location: AddressLocation) => (
            <button
              key={location.name}
              type="button"
              data-testid={`popular-facility-${location.name}`}
              onClick={() =>
                onDestinationSelected({
                  lat: location.lat,
                  lng: location.lng,
                  address: location.name,
                })
              }
            >
              {location.name}
            </button>
          )),
        )}
      </>
    );
  },
);

type PublicHomePage = () => React.ReactNode | Promise<React.ReactNode>;

function isLegacyClientInvocation(error: unknown): boolean {
  return (
    error instanceof Error &&
    /Invalid hook call|reading ['"]use[A-Z][A-Za-z]+['"]/.test(error.message)
  );
}

async function renderPublicHome() {
  const page = Home as unknown as PublicHomePage;
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  let element: React.ReactNode;

  try {
    element = await page();
  } catch (error) {
    if (!isLegacyClientInvocation(error)) {
      throw error;
    }

    // The current page is a client component. Keep the RED suite runnable
    // until the public default export becomes the async server boundary.
    element = React.createElement(Home as React.ComponentType);
  } finally {
    consoleError.mockRestore();
  }

  if (!React.isValidElement(element)) {
    throw new Error("Home public page did not return a React element");
  }

  return render(<main id="main-content">{element}</main>);
}

function expectJapaneseHomeDataError() {
  const alert = screen.queryByRole("alert");
  expect(alert).toBeInTheDocument();
  if (!alert) {
    return;
  }

  expect(alert).toHaveTextContent(/[ぁ-んァ-ン一-龯]/);
  expect(alert).toHaveTextContent(/施設|場所/);
  expect(alert).toHaveTextContent(/取得|読み込み|不正|失敗/);
}

describe("Home", () => {
  let browserFetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    browserFetchSpy = jest.spyOn(global, "fetch");
    mockReadLocationArtifact.mockReset();
    mockReadLocationArtifact.mockReturnValue(successfulArtifactResult);
  });

  afterEach(() => {
    browserFetchSpy.mockRestore();
  });

  it("PageHeaderに風ぐるまの自動案内サイトの説明を表示する", async () => {
    await renderPublicHome();

    expect(screen.getByRole("banner")).toHaveTextContent(
      "千代田区地域福祉交通「風ぐるま」の自動案内サイト",
    );
  });

  it("運営からのお知らせをh2見出しとして表示する", async () => {
    await renderPublicHome();

    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "運営からのお知らせ",
      }),
    ).toBeInTheDocument();
  });

  it("お知らせ見出しを含むsectionが見出しIDを参照する", async () => {
    await renderPublicHome();

    const heading = screen.queryByRole("heading", {
      level: 2,
      name: "運営からのお知らせ",
    });
    const section = heading?.closest("section") ?? null;

    expect(section).not.toBeNull();
    expect(heading?.id).toBeTruthy();
    expect(section?.getAttribute("aria-labelledby")).toBe(heading?.id);
  });

  it("お知らせ見出し内のInfoアイコンを装飾用として扱う", async () => {
    await renderPublicHome();

    const heading = screen.queryByRole("heading", {
      level: 2,
      name: "運営からのお知らせ",
    });
    const icon = heading?.querySelector("svg.lucide-info") ?? null;

    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("設定されたお知らせ文言をリンクの表示テキストとhrefにする", async () => {
    await renderPublicHome();

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "運営からのお知らせ",
    });
    const section = heading.closest("section");

    expect(section).not.toBeNull();
    if (!section) {
      throw new Error("お知らせ見出しを含むsectionがありません");
    }

    const link = within(section).getByRole("link", {
      name: ANNOUNCEMENT_INFORMATION,
    });

    expect(link.textContent?.trim()).toBe(ANNOUNCEMENT_INFORMATION);
    expect(link.getAttribute("href")).toBe(ANNOUNCEMENT_URL);
  });

  it("Homeに旧受賞名と賞名を表示しない", async () => {
    await renderPublicHome();

    expect(
      screen.queryByText("都知事杯オープンデータ・ハッカソン2025"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("行政課題解決賞を受賞しました"),
    ).not.toBeInTheDocument();
  });

  it("Homeに旧受賞バッジ画像を表示しない", async () => {
    await renderPublicHome();

    expect(
      screen.queryByRole("img", { name: "行政課題解決賞のオープンバッジ" }),
    ).not.toBeInTheDocument();
  });

  it("Homeに旧受賞詳細リンクを表示しない", async () => {
    await renderPublicHome();

    expect(
      screen.queryByRole("link", { name: "受賞について詳しく見る" }),
    ).not.toBeInTheDocument();
  });

  it("目的地、出発地、日時を順に入力する", async () => {
    await renderPublicHome();
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    expect(screen.getByTestId("mock-origin-selector")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-origin-selector"));
    expect(screen.getByTestId("mock-date-time-selector")).toBeInTheDocument();
    expect(screen.getByText("テスト目的地")).toBeInTheDocument();
    expect(screen.getByText("テスト住所")).toBeInTheDocument();
  });

  it("検索条件をGET結果ページURLへ渡し、入力ページではfetchしない", async () => {
    await renderPublicHome();
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    fireEvent.click(screen.getByTestId("mock-origin-selector"));
    fireEvent.click(screen.getByTestId("mock-date-time-selector"));
    fireEvent.click(screen.getByTestId("search-route"));

    expect(mockRouterPush).toHaveBeenCalledWith(
      "/routes?origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
    );
    expect(browserFetchSpy).not.toHaveBeenCalled();
  });

  it("はやさ優先をURLへ明示して端末設定に依存させない", async () => {
    await renderPublicHome();
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    fireEvent.click(screen.getByTestId("mock-origin-selector"));
    fireEvent.click(screen.getByTestId("mock-date-time-selector"));
    fireEvent.click(screen.getByRole("checkbox", { name: "はやさ優先" }));
    fireEvent.click(screen.getByTestId("search-route"));

    expect(mockRouterPush).toHaveBeenCalledWith(
      expect.stringContaining("prioritizeSpeed=true"),
    );
  });

  it("リセットで目的地入力へ戻る", async () => {
    await renderPublicHome();
    fireEvent.click(screen.getByTestId("mock-destination-selector"));
    fireEvent.click(screen.getByRole("button", { name: "検索条件をリセット" }));

    expect(screen.getByTestId("mock-destination-selector")).toBeInTheDocument();
  });

  it("server data boundaryからpopular施設を受け取り、ブラウザCDN fetchを開始しない", async () => {
    await renderPublicHome();

    expect(mockReadLocationArtifact).toHaveBeenCalledTimes(1);
    expect(mockReadLocationArtifact).toHaveBeenCalledWith();
    expect(browserFetchSpy).not.toHaveBeenCalled();
    expect(mockDestinationSelectorProps).toHaveBeenCalledWith({
      categories: successfulArtifact.sources.mainFacilities,
    });

    const popularFacilityButton = screen.queryByTestId(
      "popular-facility-千代田区役所",
    );
    expect(popularFacilityButton).toBeInTheDocument();
  });

  it("注入されたpopular施設の選択を既存の目的地入力へ引き継ぐ", async () => {
    await renderPublicHome();

    const popularFacilityButton = screen.queryByTestId(
      "popular-facility-千代田区役所",
    );
    expect(popularFacilityButton).toBeInTheDocument();
    if (!popularFacilityButton) {
      return;
    }

    fireEvent.click(popularFacilityButton);

    const selectedDestination = screen.queryByTestId("selected-destination");
    expect(selectedDestination).toBeInTheDocument();
    if (!selectedDestination) {
      return;
    }

    expect(selectedDestination).toHaveTextContent("千代田区役所");
    expect(browserFetchSpy).not.toHaveBeenCalled();
  });

  it("artifact readerの失敗を空の成功状態ではなく日本語errorとして表示する", async () => {
    mockReadLocationArtifact.mockReturnValueOnce({
      status: "error",
      error: new Error("HTTP 503"),
    } satisfies LocationArtifactReadResult);

    await renderPublicHome();

    expect(mockReadLocationArtifact).toHaveBeenCalledTimes(1);
    expectJapaneseHomeDataError();
    expect(screen.queryByTestId("popular-facility-千代田区役所")).not.toBeInTheDocument();
    expect(browserFetchSpy).not.toHaveBeenCalled();
  });

  it("popular施設が空の場合も空の成功状態ではなく日本語errorとして表示する", async () => {
    mockReadLocationArtifact.mockReturnValueOnce({
      status: "success",
      artifact: emptyPopularArtifact,
    } satisfies LocationArtifactReadResult);

    await renderPublicHome();

    expect(mockReadLocationArtifact).toHaveBeenCalledTimes(1);
    expectJapaneseHomeDataError();
    expect(screen.queryByTestId("popular-facility-千代田区役所")).not.toBeInTheDocument();
    expect(browserFetchSpy).not.toHaveBeenCalled();
  });
});
