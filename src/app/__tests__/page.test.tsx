import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Home from "../page";
import type {
  LocationArtifact,
  LocationArtifactReadResult,
} from "@/lib/location/location-artifact";

const mockRouterPush = jest.fn();
const mockReadLocationArtifact = jest.fn();

const ANNOUNCEMENT_INFORMATION =
  "運行情報の更新";
const ANNOUNCEMENT_URL = "/service-update";

const popularFacility = {
  name: "千代田区役所",
  lat: 35.694,
  lng: 139.753,
};

const successfulArtifact: LocationArtifact = {
  status: "validated",
  sourceUris: {
    datasetJsonLdUri: "https://fixtures.example.test/dataset.jsonld",
    osmMirrorUri: "https://fixtures.example.test/mirrors/osm.json",
    townGeoJsonUri: "https://fixtures.example.test/chiyoda-towns.geojson",
  },
  sources: {
    routeDestinations: [
      {
        category: "行政・相談",
        categoryId: "1302",
        locations: [popularFacility],
      },
    ],
    locations: [
      {
        category: "公共施設",
        categoryId: "public-facilities",
        locations: [
          {
            id: "urn:uuid:00000000-0000-4000-8000-2db34a2b56d3",
            name: "神田図書館",
            lat: 35.694,
            lng: 139.768,
            relatedPages: [],
            osmElement: { type: "node", id: 263 },
            wheelchair: "yes",
            osmEditUrl: "https://www.openstreetmap.org/edit?node=263",
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
    routeDestinations: [],
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

type PublicHomePage = () => React.ReactNode | Promise<React.ReactNode>;

async function renderPublicHome() {
  const page = Home as unknown as PublicHomePage;
  const element = await page();

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

  function routeForm() {
    const form = document.querySelector<HTMLFormElement>('form[action="/routes"]');
    if (!form) throw new Error("最終検索フォームがありません");
    return form;
  }

  async function selectAddress(label: string, lat: number, lng: number) {
    browserFetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        results: [
          { name: `確定${label}`, address: `千代田区${label}一丁目1番`, lat, lng, kind: "public" },
        ],
      }),
    });
    await userEvent.setup().type(screen.getByRole("textbox", { name: label }), "神田駅{Enter}");
    const group = screen.getByRole("group", { name: label });
    const list = await within(group).findByRole("list", { name: `${label}の候補から選ぶ` });
    fireEvent.click(within(list).getAllByRole("button")[0]);
    expect(await screen.findByTestId(label === "目的地" ? "selected-destination" : "selected-origin")).toHaveTextContent(`確定${label}`);
  }

  it("4つのfieldsetを最初から順に表示し、フォームを入れ子にしない", async () => {
    const { container } = await renderPublicHome();
    expect(Array.from(container.querySelectorAll("fieldset > legend"), node => node.textContent)).toEqual(["目的地", "出発地", "日時", "優先条件"]);
    expect(container.querySelectorAll("form")).toHaveLength(3);
    expect(container.querySelector("form form")).toBeNull();
    expect(container.querySelector('[aria-live] form')).toBeNull();
    expect(container.querySelector("fieldset .card")).toBeNull();
    expect(screen.queryByRole("button", { name: /リセット/ })).not.toBeInTheDocument();
  });

  it("住所欄に検索ボタンを置かず、最終検索は可視文字「経路を検索」のsubmitにする", async () => {
    await renderPublicHome();
    expect(screen.queryAllByRole("button", { name: "検索" })).toHaveLength(0);
    const submit = within(routeForm()).getByRole("button", { name: "経路を検索" });
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit).toHaveAccessibleName("経路を検索");
    expect(within(submit).getAllByText("経路を検索").some(node => !node.classList.contains("sr-only"))).toBe(true);
  });

  it("住所欄のEnterは空の日時に妨げられず住所だけを検索する", async () => {
    await renderPublicHome();
    fireEvent.change(screen.getByLabelText("日時", { selector: "input" }), { target: { value: "" } });
    const submit = jest.fn();
    routeForm().addEventListener("submit", submit);
    await selectAddress("目的地", 35.7, 139.78);
    expect(browserFetchSpy).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it("確定座標と日時・ラジオ値を通常のGET送信に渡す", async () => {
    await renderPublicHome();
    await selectAddress("目的地", 35.7, 139.78);
    await selectAddress("出発地", 35.68, 139.76);
    fireEvent.change(screen.getByLabelText("日時", { selector: "input" }), { target: { value: "2026-07-18T09:30" } });
    const form = routeForm();
    expect(form).toHaveAttribute("method", "get");
    expect(Object.fromEntries(new FormData(form))).toEqual({ origin: "35.68,139.76", destination: "35.7,139.78", time: "2026-07-18T09:30", isDeparture: "true", prioritizeSpeed: "false" });
    const event = new Event("submit", { bubbles: true, cancelable: true });
    fireEvent(form, event);
    expect(event.defaultPrevented).toBe(false);
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(browserFetchSpy).toHaveBeenCalledTimes(2);
  });

  it.each(["目的地", "出発地"])("%sの再編集はその座標だけを無効化し条件を保持する", async label => {
    await renderPublicHome();
    await selectAddress("目的地", 35.7, 139.78);
    await selectAddress("出発地", 35.68, 139.76);
    const time = screen.getByLabelText("日時", { selector: "input" });
    fireEvent.change(time, { target: { value: "2026-07-18T09:30" } });
    fireEvent.click(screen.getByRole("radio", { name: "歩いてもいい、早く着きたい" }));
    const group = screen.getByRole("group", { name: label });
    expect(within(group).getByTestId(label === "目的地" ? "selected-destination" : "selected-origin").tagName).toBe("P");
    fireEvent.click(within(group).getByRole("button", { name: "なおす" }));
    expect(screen.getByRole("textbox", { name: label })).toHaveFocus();
    const data = new FormData(routeForm());
    expect(data.get(label === "目的地" ? "destination" : "origin") || "").toBe("");
    expect(data.get(label === "目的地" ? "origin" : "destination")).toBe(label === "目的地" ? "35.68,139.76" : "35.7,139.78");
    expect(time).toHaveValue("2026-07-18T09:30");
    expect(data.get("prioritizeSpeed")).toBe("true");
    screen.getByTestId("search-route").focus();
    const event = new Event("submit", { bubbles: true, cancelable: true });
    fireEvent(routeForm(), event);
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole("textbox", { name: label })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: label })).toHaveFocus();
  });

  it("未確定地点は送信を止めて両項目にエラーを関連付ける", async () => {
    await renderPublicHome();
    screen.getByTestId("search-route").focus();
    const event = new Event("submit", { bubbles: true, cancelable: true });
    fireEvent(routeForm(), event);
    expect(event.defaultPrevented).toBe(true);
    const destination = screen.getByRole("textbox", { name: "目的地" });
    expect(destination).toHaveFocus();
    expect(destination).toHaveAccessibleDescription(expect.stringContaining("目的地を確定してください"));
    screen.getByTestId("search-route").focus();
    fireEvent.submit(routeForm());
    expect(destination).toHaveFocus();
    for (const label of ["目的地", "出発地"]) expect(screen.getByRole("textbox", { name: label })).toHaveAttribute("aria-invalid", "true");
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(browserFetchSpy).not.toHaveBeenCalled();
  });

  it("既存の目的地ディープリンクも全グループを表示する", async () => {
    window.history.replaceState({}, "", `/?destination=${encodeURIComponent(JSON.stringify({ lat: 35.7, lng: 139.78, address: "リンク目的地" }))}`);
    await renderPublicHome();
    expect(screen.getByTestId("selected-destination")).toHaveTextContent("リンク目的地");
    expect(within(screen.getByRole("group", { name: "目的地" })).getByRole("button", { name: "なおす" })).toBeInTheDocument();
    for (const name of ["出発地", "日時", "優先条件"]) expect(screen.getByRole("group", { name })).toBeInTheDocument();
    expect(browserFetchSpy).not.toHaveBeenCalled();
  });

  it("優先条件を既存キーから復元して保存し、到着指定と共に送信する", async () => {
    localStorage.setItem("prioritizeSpeed", "true");
    await renderPublicHome();
    expect(screen.getByRole("radio", { name: "歩いてもいい、早く着きたい" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "なるべく歩きたくない、時間がかかってもいい" }));
    expect(localStorage.getItem("prioritizeSpeed")).toBe("false");
    fireEvent.click(screen.getByRole("radio", { name: "到着" }));
    expect(new FormData(routeForm()).get("isDeparture")).toBe("false");
    expect(new FormData(routeForm()).get("prioritizeSpeed")).toBe("false");
  });

  it("localStorageが使えなくても優先条件を選択して送信できる", async () => {
    const storage = window.localStorage;
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: jest.fn(() => { throw new Error("denied"); }),
      setItem: jest.fn(() => { throw new Error("denied"); }),
    } });
    try {
      await renderPublicHome();
      expect(screen.getByRole("radio", { name: "なるべく歩きたくない、時間がかかってもいい" })).toBeChecked();
      fireEvent.click(screen.getByRole("radio", { name: "歩いてもいい、早く着きたい" }));
      expect(new FormData(routeForm()).get("prioritizeSpeed")).toBe("true");
    } finally {
      Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
    }
  });

  it("artifactの掲載21件をカテゴリごとに表示し、実行時に外部取得をしない", async () => {
    const routeDestinations = [
      {
        category: "行政・相談",
        categoryId: "1302",
        names: [
          "千代田区役所",
          "千代田区 富士見出張所・区民館",
          "千代田区神保町出張所・区民館",
          "千代田区役所 神田公園出張所・区民館",
          "千代田区役所 万世橋出張所・区民館",
          "千代田区役所和泉橋出張所",
        ],
      },
      {
        category: "子育て・福祉",
        categoryId: "1499",
        names: [
          "千代田区立障害者福祉センター　えみふる",
          "千代田区障害者よろず相談 Light",
          "千代田区立一番町高齢者在宅介護支援センター",
          "岩本町ほほえみプラザ",
          "ちよだパークサイドプラザ",
          "神田児童館",
          "西神田児童・家庭支援センター",
          "千代田区立四番町児童館",
          "一番町児童館",
          "富士見みらい館",
        ],
      },
      {
        category: "学び・図書館",
        categoryId: "1512",
        names: [
          "千代田区立千代田図書館",
          "昌平まちかど図書館",
          "千代田区立神田まちかど図書館",
          "ちよだパークサイドプラザ区民図書室",
          "千代田区立四番町図書館",
        ],
      },
    ].map(({ category, categoryId, names }) => ({
      category,
      categoryId,
      locations: names.map((name) => ({ name, lat: 35.694, lng: 139.753 })),
    }));

    mockReadLocationArtifact.mockReturnValueOnce({
      status: "success",
      artifact: {
        ...successfulArtifact,
        sources: {
          ...successfulArtifact.sources,
          routeDestinations,
        },
      },
    } satisfies LocationArtifactReadResult);

    await renderPublicHome();

    expect(mockReadLocationArtifact).toHaveBeenCalledTimes(1);
    expect(browserFetchSpy).not.toHaveBeenCalled();
    for (const category of routeDestinations) {
      fireEvent.click(screen.getByText(category.category, { selector: "summary" }));
      for (const location of category.locations) {
        expect(screen.getByRole("button", { name: location.name })).toBeInTheDocument();
      }
    }
    expect(routeDestinations).toHaveLength(3);
    expect(routeDestinations.flatMap((category) => category.locations)).toHaveLength(21);
  });

  it("server data boundaryからpopular施設を受け取り、ブラウザCDN fetchを開始しない", async () => {
    await renderPublicHome();

    expect(mockReadLocationArtifact).toHaveBeenCalledTimes(1);
    expect(mockReadLocationArtifact).toHaveBeenCalledWith();
    expect(browserFetchSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("行政・相談", { selector: "summary" }));
    const popularFacilityButton = screen.queryByRole("button", { name: "千代田区役所" });
    expect(popularFacilityButton).toBeInTheDocument();
  });

  it("注入されたpopular施設の選択を既存の目的地入力へ引き継ぐ", async () => {
    await renderPublicHome();

    fireEvent.click(screen.getByText("行政・相談", { selector: "summary" }));
    fireEvent.click(screen.getByRole("button", { name: "千代田区役所" }));
    expect(screen.getByTestId("selected-destination")).toHaveTextContent("千代田区役所");
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
    expect(screen.queryByRole("button", { name: "千代田区役所" })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: "千代田区役所" })).not.toBeInTheDocument();
    expect(browserFetchSpy).not.toHaveBeenCalled();
  });
});
