import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationCategoryList from "../LocationCategoryList";
import type { LocationPageLocation } from "@/types/location-pages";

type GetCurrentPosition = Geolocation["getCurrentPosition"];

const distantLocation: LocationPageLocation = {
  id: "location-far",
  name: "遠い施設",
  lat: 35.75,
  lng: 139.8,
  areaName: "あ地区",
  nodeCopyright: "データ提供元",
  licence: "CC BY",
  licenceUri: "https://example.test/license",
};

const nearbyLocation: LocationPageLocation = {
  id: "location-near",
  name: "近い施設",
  lat: 35.68,
  lng: 139.76,
  areaName: "か地区",
  nodeCopyright: "データ提供元",
  licence: "CC BY",
  licenceUri: "https://example.test/license",
};

const nextDistantLocation: LocationPageLocation = {
  id: "next-location-far",
  name: "新しい遠い施設",
  lat: 35.75,
  lng: 139.8,
  areaName: "あ地区",
  nodeCopyright: "データ提供元",
  licence: "CC BY",
  licenceUri: "https://example.test/license",
};

const nextNearbyLocation: LocationPageLocation = {
  id: "next-location-near",
  name: "新しい近い施設",
  lat: 35.68,
  lng: 139.76,
  areaName: "か地区",
  nodeCopyright: "データ提供元",
  licence: "CC BY",
  licenceUri: "https://example.test/license",
};

const categoryLocations = [distantLocation, nearbyLocation];
const nextCategoryLocations = [nextDistantLocation, nextNearbyLocation];
const allFixtures = [...categoryLocations, ...nextCategoryLocations];

const originalFetch = global.fetch;
const originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "geolocation",
);
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
const mockGetCurrentPosition = jest.fn() as jest.MockedFunction<GetCurrentPosition>;

function jsonResponse(body: unknown, ok: boolean, status: number): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

function readVisibleLocationNames(): string[] {
  return screen
    .getAllByRole("link")
    .flatMap((link) => {
      const heading = link.querySelector("h2");
      const fixture = allFixtures.find(
        (location) => heading?.textContent?.trim() === location.name,
      );
      return fixture ? [fixture.name] : [];
    });
}

function getGpsButton(): HTMLElement {
  return screen.getByRole("button", {
    name: /現在地|GPS|位置情報/,
  });
}

function getAddressInput(): HTMLElement {
  return screen.getByRole("textbox", {
    name: /住所|場所/,
  });
}

function getAddressSearchButton(): HTMLElement {
  return screen.getByRole("button", {
    name: /検索/,
  });
}

function createPosition(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: {
      accuracy: 0,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude,
      longitude,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}

describe("LocationCategoryListの距離順表示", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockGetCurrentPosition.mockReset();
    global.fetch = mockFetch;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: mockGetCurrentPosition },
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    if (originalGeolocationDescriptor) {
      Object.defineProperty(
        navigator,
        "geolocation",
        originalGeolocationDescriptor,
      );
    } else {
      Reflect.deleteProperty(navigator, "geolocation");
    }
  });

  it("初期表示は事前計算済みの地域グループ順で、自動的に位置情報や取得を要求しない", () => {
    render(<LocationCategoryList locations={categoryLocations} />);

    expect(screen.getByRole("heading", { name: "あ地区" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "か地区" })).toBeInTheDocument();
    expect(readVisibleLocationNames()).toEqual(["遠い施設", "近い施設"]);
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("現在地の利用を明示した後は、同じ施設を距離順に表示する", async () => {
    mockGetCurrentPosition.mockImplementation((success) => {
      success(createPosition(nearbyLocation.lat, nearbyLocation.lng));
    });

    render(<LocationCategoryList locations={categoryLocations} />);
    fireEvent.click(getGpsButton());

    await waitFor(() => {
      expect(readVisibleLocationNames()).toEqual(["近い施設", "遠い施設"]);
    });
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("住所検索を明示した後は、同じ施設を距離順に表示する", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        {
          success: true,
          results: [{ lat: nearbyLocation.lat, lng: nearbyLocation.lng }],
        },
        true,
        200,
      ),
    );

    render(<LocationCategoryList locations={categoryLocations} />);
    fireEvent.change(getAddressInput(), { target: { value: "近い施設の住所" } });
    fireEvent.click(getAddressSearchButton());

    await waitFor(() => {
      expect(readVisibleLocationNames()).toEqual(["近い施設", "遠い施設"]);
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it("GPSの失敗時は地域グループ順の施設を保持し、日本語の項目エラーを表示する", async () => {
    mockGetCurrentPosition.mockImplementation((_success, error) => {
      error?.({
        code: 1,
        message: "User denied Geolocation",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });

    render(<LocationCategoryList locations={categoryLocations} />);
    fireEvent.click(getGpsButton());

    const error = await screen.findByText(
      /位置情報.*(失敗|拒否|できません)|現在地.*(失敗|拒否|できません)/,
    );
    expect(error).toHaveTextContent(/[ぁ-んァ-ン一-龥]/);
    expect(readVisibleLocationNames()).toEqual(["遠い施設", "近い施設"]);
  });

  it("住所検索の失敗時は地域グループ順の施設を保持し、日本語の項目エラーを表示する", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(
        { success: false, error: "住所が見つかりませんでした" },
        false,
        500,
      ),
    );

    render(<LocationCategoryList locations={categoryLocations} />);
    fireEvent.change(getAddressInput(), { target: { value: "存在しない住所" } });
    fireEvent.click(getAddressSearchButton());

    const error = await screen.findByText(
      /(住所|場所|ジオコーディング).*(見つかりません|失敗|できません|エラー)/,
    );
    expect(error).toHaveTextContent(/[ぁ-んァ-ン一-龥]/);
    expect(readVisibleLocationNames()).toEqual(["遠い施設", "近い施設"]);
  });

  it("別カテゴリの施設集合へ切り替えると、距離順状態を引き継がず地域グループ順へ戻る", async () => {
    mockGetCurrentPosition.mockImplementation((success) => {
      success(createPosition(nearbyLocation.lat, nearbyLocation.lng));
    });

    const view = render(<LocationCategoryList locations={categoryLocations} />);
    fireEvent.click(getGpsButton());

    await waitFor(() => {
      expect(readVisibleLocationNames()).toEqual(["近い施設", "遠い施設"]);
    });

    view.rerender(<LocationCategoryList locations={nextCategoryLocations} />);

    await waitFor(() => {
      expect(readVisibleLocationNames()).toEqual(["新しい遠い施設", "新しい近い施設"]);
    });
    expect(window.location.search).toBe("");
  });
});
