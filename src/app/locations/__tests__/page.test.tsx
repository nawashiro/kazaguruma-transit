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

jest.mock("../../../utils/addressLoader", () => ({
  loadKeyLocationsData: jest.fn(),
  convertToLocation: jest.fn(),
}));

jest.mock("../../../utils/clientGeoUtils", () => ({
  loadGeoJSON: jest.fn(),
  groupLocationsByArea: jest.fn(),
  formatAreaName: jest.fn(),
  getAreaNameFromCoordinates: jest.fn(),
}));

const addressLoaderMock = jest.requireMock("../../../utils/addressLoader") as {
  loadKeyLocationsData: jest.Mock;
  convertToLocation: jest.Mock;
};
const clientGeoUtilsMock = jest.requireMock("../../../utils/clientGeoUtils") as {
  loadGeoJSON: jest.Mock;
  groupLocationsByArea: jest.Mock;
  formatAreaName: jest.Mock;
  getAreaNameFromCoordinates: jest.Mock;
};
const mockLoadKeyLocationsData = addressLoaderMock.loadKeyLocationsData;
const mockConvertToLocation = addressLoaderMock.convertToLocation;
const mockLoadGeoJSON = clientGeoUtilsMock.loadGeoJSON;
const mockGroupLocationsByArea = clientGeoUtilsMock.groupLocationsByArea;
const mockFormatAreaName = clientGeoUtilsMock.formatAreaName;
const mockGetAreaNameFromCoordinates = clientGeoUtilsMock.getAreaNameFromCoordinates;
const mockFetch = global.fetch as jest.Mock;

describe("LocationsPage", () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockFetch.mockReset();
    mockLoadKeyLocationsData.mockReset();
    mockLoadKeyLocationsData.mockResolvedValue([categoryFixture]);
    mockConvertToLocation.mockReset();
    mockConvertToLocation.mockImplementation((location: KeyLocation) => ({
      lat: location.lat,
      lng: location.lng,
      address: location.name,
    }));
    mockLoadGeoJSON.mockReset();
    mockLoadGeoJSON.mockResolvedValue({
      type: "FeatureCollection",
      features: [],
    });
    mockGroupLocationsByArea.mockReset();
    mockGroupLocationsByArea.mockImplementation((locations: KeyLocation[]) => ({
      千代田: locations,
    }));
    mockFormatAreaName.mockReset();
    mockFormatAreaName.mockImplementation((area: string) => area);
    mockGetAreaNameFromCoordinates.mockReset();
    mockGetAreaNameFromCoordinates.mockReturnValue("千代田");
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
