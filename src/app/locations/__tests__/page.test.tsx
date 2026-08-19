import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationsPage from "../page";
import type { KeyLocation, KeyLocationCategory } from "../../../utils/addressLoader";

const locationFixture: KeyLocation = {
  id: "kanda-library-日本",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  area: "千代田",
  description: "地域の図書館です",
  imageUri: "https://example.test/kanda-library.jpg",
  uri: "https://example.test/kanda-library",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const categoryFixture: KeyLocationCategory = {
  category: "公共施設",
  "category:en": "public-facilities",
  locations: [locationFixture],
};

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (url: string) => mockRouterPush(url),
  }),
}));

jest.mock("../../../lib/location/location-list-state", () => ({
  ...jest.requireActual("../../../lib/location/location-list-state"),
  loadLocationCategories: jest.fn(),
  groupCategoryLocationsByArea: jest.fn(),
}));

const locationListStateMock = jest.requireMock(
  "../../../lib/location/location-list-state"
) as {
  loadLocationCategories: jest.Mock;
  groupCategoryLocationsByArea: jest.Mock;
};
const mockLoadLocationCategories = locationListStateMock.loadLocationCategories;
const mockGroupCategoryLocationsByArea =
  locationListStateMock.groupCategoryLocationsByArea;
const mockFetch = global.fetch as jest.Mock;
let originalGeolocationDescriptor: PropertyDescriptor | undefined;

describe("LocationsPage", () => {
  beforeEach(() => {
    originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "geolocation"
    );
    mockRouterPush.mockReset();
    mockFetch.mockReset();
    mockLoadLocationCategories.mockReset();
    mockLoadLocationCategories.mockResolvedValue([categoryFixture]);
    mockGroupCategoryLocationsByArea.mockReset();
    mockGroupCategoryLocationsByArea.mockImplementation((locations: KeyLocation[]) => ({
      千代田: locations,
    }));
  });

  afterEach(() => {
    if (originalGeolocationDescriptor) {
      Object.defineProperty(
        navigator,
        "geolocation",
        originalGeolocationDescriptor
      );
    } else {
      Reflect.deleteProperty(navigator, "geolocation");
    }
  });

  it("カテゴリデータの読み込み後に最初のタブを選択する", async () => {
    render(<LocationsPage />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "公共施設" })).toHaveClass(
        "tab-active"
      );
    });

    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "locations-category-公共施設"
    );
  });

  it("住所検索のjoinが左右の角丸とボタンの結合状態を持つ", async () => {
    render(<LocationsPage />);

    const input = await screen.findByLabelText("住所");
    const submit = screen.getByRole("button", { name: "検索" });

    expect(input).toHaveClass("!rounded-l-full");
    expect(submit).toHaveClass("!rounded-r-full");
    expect(submit).not.toHaveClass("rounded-full");
  });

  it("場所カードを一意なIDを含むnative詳細リンクとして公開し、要約を保持する", async () => {
    render(<LocationsPage />);

    const locationLink = await screen.findByRole("link", {
      name: new RegExp(locationFixture.name),
    });

    expect(locationLink.tagName).toBe("A");
    expect(locationLink).toHaveAttribute(
      "href",
      `/location-detail/${encodeURIComponent(locationFixture.id)}`
    );
    expect(locationLink).toHaveTextContent("千代田");
    expect(locationLink).toHaveTextContent(locationFixture.description ?? "");
    expect(locationLink).not.toHaveAttribute("tabindex", "-1");

    locationLink.focus();
    expect(document.activeElement).toBe(locationLink);
  });

  it("初期施設データ取得失敗をエラーアイコン付きalertとして通知する", async () => {
    mockLoadLocationCategories.mockRejectedValueOnce(
      new Error("主要施設データの取得に失敗しました")
    );

    render(<LocationsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/^施設データの読み込みに失敗しました$/);
    expect(alert).toHaveClass("alert-soft", "text-base-content!");
    expect(alert.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it("住所検索失敗を入力欄に関連付いたエラーalertとして通知する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "住所検索に失敗しました" }),
    });

    render(<LocationsPage />);

    const addressInput = await screen.findByLabelText("住所");
    fireEvent.change(addressInput, { target: { value: "神田駅" } });
    fireEvent.click(screen.getByRole("button", { name: "検索" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/^住所検索に失敗しました$/);
    expect(alert).toHaveClass("alert-soft", "text-base-content!");
    expect(alert).toHaveAttribute("id", "location-search-error");
    expect(alert.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(addressInput).toHaveAttribute(
      "aria-describedby",
      "location-search-error"
    );
  });

  it("現在地取得成功をチェックアイコン付きstatusとして通知する", async () => {
    const mockGetCurrentPosition = jest.fn(
      (onSuccess: (position: GeolocationPosition) => void) => {
        onSuccess({
          coords: {
            latitude: 35.694,
            longitude: 139.768,
          },
        } as GeolocationPosition);
      }
    );
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: mockGetCurrentPosition },
    });

    render(<LocationsPage />);

    fireEvent.click(
      await screen.findByRole("button", { name: "現在地を取得" })
    );

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(
      /^位置情報を取得しました！カテゴリを選択すると最寄りの施設が表示されます$/
    );
    expect(status).toHaveClass("alert-success");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it("429 + limitExceededではlocations発のrate-limitへ一度だけ遷移し、旧モーダルを表示しない", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ limitExceeded: true }),
    });

    const view = render(<LocationsPage />);
    const addressInput = await screen.findByLabelText("住所");
    const searchButton = screen.getByRole("button", { name: "検索" });

    fireEvent.change(addressInput, { target: { value: "神田駅" } });
    fireEvent.click(searchButton);

    await waitFor(() => expect(addressInput).not.toBeDisabled());
    expect(searchButton).not.toBeDisabled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith("/rate-limit?source=locations");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    view.rerender(<LocationsPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });
});
