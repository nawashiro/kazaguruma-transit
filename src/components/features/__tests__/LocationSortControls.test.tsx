import React, { type ComponentType } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";

/**
 * T033 RED boundary: the sort control is exercised through the public browser
 * URL/geolocation boundaries, not through private helpers or implementation
 * state.
 */
type LocationSortControlsComponent = ComponentType;
type PublicModule = Record<string, unknown>;

const BASE_URL = "https://kazaguruma.invalid";
const CATEGORY_PATH = "/locations/hospital";
const OUT_OF_AREA_ORIGIN = "51.5074,-0.1278";
const EXISTING_ORIGIN = "35.681236,139.767125";

const mockRouterReplace = jest.fn<void, [string]>();
const mockUsePathname = jest.fn(() => CATEGORY_PATH);
const mockUseSearchParams = jest.fn(() => new URLSearchParams());
const mockGetCurrentPosition = jest.fn<
  void,
  [PositionCallback, PositionErrorCallback?, PositionOptions?]
>();
const mockFetch = global.fetch as jest.Mock;

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({ replace: (href: string) => mockRouterReplace(href) }),
}));

jest.mock("next/link", () => {
  const MockLink = React.forwardRef<
    HTMLAnchorElement,
    React.PropsWithChildren<
      React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
    >
  >(({ children, href, ...props }, ref) => (
    <a ref={ref} href={href} {...props}>
      {children}
    </a>
  ));
  MockLink.displayName = "MockLink";

  return {
    __esModule: true,
    default: MockLink,
  };
});

function isRecord(value: unknown): value is PublicModule {
  return typeof value === "object" && value !== null;
}

function loadLocationSortControls(): LocationSortControlsComponent {
  const modulePath = "../LocationSortControls";
  let loaded: unknown = null;
  let loadError: unknown = null;

  try {
    // Keep the planned public component boundary collectible before T035.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    loaded = require(modulePath);
  } catch (error) {
    loadError = error;
  }

  expect(loadError).toBeNull();
  expect(isRecord(loaded)).toBe(true);
  const publicModule = loaded as PublicModule;
  const component = publicModule.default ?? publicModule.LocationSortControls;
  expect(typeof component).toBe("function");
  return component as LocationSortControlsComponent;
}

function renderControls(
  pathname = CATEGORY_PATH,
  origin?: string,
): ReturnType<typeof render> {
  mockUsePathname.mockReturnValue(pathname);
  mockUseSearchParams.mockReturnValue(
    origin === undefined
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams({ origin }),
  );

  const LocationSortControls = loadLocationSortControls();
  return render(<LocationSortControls />);
}

function createPosition(
  latitude: number,
  longitude: number,
): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 1,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 0,
    toJSON: () => ({}),
  };
}

function createPositionError(code: 1 | 2 | 3): GeolocationPositionError {
  return {
    code,
    message: "test geolocation error",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

function getControl(
  role: "link" | "button",
  name: string | RegExp,
): HTMLElement {
  const control = screen.queryByRole(role, { name });
  expect(control).toBeInTheDocument();
  return control as HTMLElement;
}

function isAccessibleSelected(control: HTMLElement): boolean {
  const ariaCurrent = control.getAttribute("aria-current");
  const ariaPressed = control.getAttribute("aria-pressed");
  const ariaSelected = control.getAttribute("aria-selected");

  return (
    (ariaCurrent !== null && ariaCurrent !== "false") ||
    ariaPressed === "true" ||
    ariaSelected === "true"
  );
}

function expectSelected(control: HTMLElement, selected: boolean): void {
  expect(isAccessibleSelected(control)).toBe(selected);
}

function getHref(control: HTMLElement): URL {
  return new URL(control.getAttribute("href") ?? "", BASE_URL);
}

async function expectJapaneseError(
  expectedDescription?: string,
): Promise<HTMLElement> {
  const alert = await waitFor(() => screen.getByRole("alert"));
  expect(alert.textContent ?? "").toMatch(/[ぁ-んァ-ン一-龯]/);
  expect(alert).toHaveTextContent(/位置情報|座標|取得|対応|GPS/);
  expect(alert).toHaveClass(
    "alert",
    "alert-error",
    "alert-soft",
    "text-base-content!",
  );
  expect(within(alert).getByText("エラー", { exact: true })).toBeVisible();
  if (expectedDescription) {
    expect(alert).toHaveTextContent(expectedDescription);
  }
  return alert;
}

let originalGeolocationDescriptor: PropertyDescriptor | undefined;
let originalBrowserUrl = "/";

beforeEach(() => {
  originalBrowserUrl =
    window.location.pathname + window.location.search + window.location.hash;
  window.history.replaceState({}, "", "/");

  mockRouterReplace.mockReset();
  mockUsePathname.mockReset();
  mockUsePathname.mockReturnValue(CATEGORY_PATH);
  mockUseSearchParams.mockReset();
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
  mockGetCurrentPosition.mockReset();
  mockFetch.mockReset();

  originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "geolocation",
  );
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: { getCurrentPosition: mockGetCurrentPosition },
  });
});

afterEach(() => {
  if (originalGeolocationDescriptor) {
    Object.defineProperty(
      navigator,
      "geolocation",
      originalGeolocationDescriptor,
    );
  } else {
    Reflect.deleteProperty(navigator, "geolocation");
  }
  window.history.replaceState({}, "", originalBrowserUrl);
});

describe("LocationSortControls GPS/origin/error contract (T033/T071 RED)", () => {
  it("カテゴリ直下に2操作を表示し、originなしでは町字モードを選択状態で伝える", () => {
    renderControls();
    const townControl = getControl("link", "町字で並べる");
    const distanceControl = getControl("button", "近い順に並べる");

    expectSelected(townControl, true);
    expectSelected(distanceControl, false);
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it("町字で並べるは現在カテゴリpathへのqueryなしhrefを持つ", () => {
    renderControls(CATEGORY_PATH, EXISTING_ORIGIN);
    const townControl = getControl("link", "町字で並べる");
    const distanceControl = getControl("button", "近い順に並べる");

    const href = getHref(townControl);
    expect(href.pathname).toBe(CATEGORY_PATH);
    expect(href.search).toBe("");
    expectSelected(townControl, false);
    expectSelected(distanceControl, true);
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it("有限な千代田区外originを距離モードとして選択表示する", () => {
    renderControls(CATEGORY_PATH, OUT_OF_AREA_ORIGIN);
    const townControl = getControl("link", "町字で並べる");
    const distanceControl = getControl("button", "近い順に並べる");

    expectSelected(townControl, false);
    expectSelected(distanceControl, true);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("明示クリック前はGPSを呼ばず、成功時はlat,lng順originで現在pathへreplaceする", () => {
    renderControls();
    const distanceControl = getControl("button", "近い順に並べる");

    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    mockGetCurrentPosition.mockImplementationOnce((success) => {
      success(createPosition(35.681236, 139.767125));
    });

    fireEvent.click(distanceControl);

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    expect(mockRouterReplace).toHaveBeenCalledTimes(1);
    const replacement = mockRouterReplace.mock.calls[0]?.[0];
    expect(typeof replacement).toBe("string");
    const url = new URL(replacement as string, BASE_URL);
    expect(url.pathname).toBe(CATEGORY_PATH);
    expect(url.searchParams.get("origin")).toBe("35.681236,139.767125");
    expect([...url.searchParams.keys()]).toEqual(["origin"]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("近い順のGPS取得中は日本語のloading statusを表示する", () => {
    renderControls();
    const distanceControl = getControl("button", "近い順に並べる");

    mockGetCurrentPosition.mockImplementationOnce(() => undefined);
    fireEvent.click(distanceControl);

    const status = screen.queryByRole("status");
    expect(status).not.toBeNull();
    expect(status).toHaveTextContent(/取得中|読み込み中|確認中/);
  });

  it.each([
    [
      "permission denied",
      createPositionError(1),
      "位置情報の利用が許可されませんでした。GPSの権限を確認してください。",
    ],
    [
      "timeout",
      createPositionError(3),
      "位置情報の取得がタイムアウトしました。もう一度お試しください。",
    ],
  ] as const)(
    "originなしのGPS %sでは日本語errorを表示し、originを追加しない",
    async (_caseName, positionError, expectedDescription) => {
      renderControls();
      const townControl = getControl("link", "町字で並べる");
      const distanceControl = getControl("button", "近い順に並べる");

      mockGetCurrentPosition.mockImplementationOnce((_success, error) => {
        error?.(positionError);
      });
      fireEvent.click(distanceControl);

      await expectJapaneseError(expectedDescription);
      expect(mockRouterReplace).not.toHaveBeenCalled();
      expectSelected(townControl, true);
      expectSelected(distanceControl, false);
      expect(getHref(townControl).search).toBe("");
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it("Geolocation未対応ブラウザでは日本語errorを表示し、originを追加しない", async () => {
    renderControls();
    const townControl = getControl("link", "町字で並べる");
    const distanceControl = getControl("button", "近い順に並べる");

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      enumerable: true,
      writable: true,
      value: undefined,
    });
    fireEvent.click(distanceControl);

    await expectJapaneseError(
      "お使いのブラウザではGPSによる位置情報の取得に対応していません。",
    );
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
    expectSelected(townControl, true);
    expectSelected(distanceControl, false);
    expect(getHref(townControl).search).toBe("");
  });

  it.each([
    ["NaN latitude", Number.NaN, 139.767125],
    ["infinite longitude", 35.681236, Number.POSITIVE_INFINITY],
  ] as const)(
    "GPSが%sを返した場合は日本語errorを表示し、originを追加しない",
    async (_caseName, latitude, longitude) => {
      renderControls();
      const townControl = getControl("link", "町字で並べる");
      const distanceControl = getControl("button", "近い順に並べる");

      mockGetCurrentPosition.mockImplementationOnce((success) => {
        success(createPosition(latitude, longitude));
      });
      fireEvent.click(distanceControl);

      await expectJapaneseError("GPSから有効な座標を取得できませんでした。");
      expect(mockRouterReplace).not.toHaveBeenCalled();
      expectSelected(townControl, true);
      expectSelected(distanceControl, false);
      expect(getHref(townControl).search).toBe("");
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it("無効なoriginではclient alertを表示せず、町字fallbackとURLを維持する", () => {
    window.history.replaceState(
      {},
      "",
      `${CATEGORY_PATH}?origin=invalid-origin`,
    );
    renderControls(CATEGORY_PATH);
    const townControl = getControl("link", "町字で並べる");
    const distanceControl = getControl("button", "近い順に並べる");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText("originの座標を解釈できません。町字で表示します。", {
        exact: true,
      }),
    ).not.toBeInTheDocument();
    expectSelected(townControl, true);
    expectSelected(distanceControl, false);
    expect(getHref(townControl).search).toBe("");
    expect(window.location.pathname).toBe(CATEGORY_PATH);
    expect(window.location.search).toBe("?origin=invalid-origin");
    expect(new URLSearchParams(window.location.search).get("origin")).toBe(
      "invalid-origin",
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("有効な既存originでGPS再取得に失敗しても距離モードとoriginを維持する", async () => {
    const expectedSearch = `?${new URLSearchParams({ origin: EXISTING_ORIGIN }).toString()}`;
    window.history.replaceState(
      {},
      "",
      `${CATEGORY_PATH}${expectedSearch}`,
    );
    renderControls(CATEGORY_PATH);
    const townControl = getControl("link", "町字で並べる");
    const distanceControl = getControl("button", "近い順に並べる");

    expectSelected(townControl, false);
    expectSelected(distanceControl, true);
    mockGetCurrentPosition.mockImplementationOnce((_success, error) => {
      error?.(createPositionError(3));
    });
    fireEvent.click(distanceControl);

    await expectJapaneseError(
      "位置情報の取得がタイムアウトしました。もう一度お試しください。",
    );
    expect(window.location.pathname).toBe(CATEGORY_PATH);
    expect(window.location.search).toBe(expectedSearch);
    expect(new URLSearchParams(window.location.search).get("origin")).toBe(
      EXISTING_ORIGIN,
    );
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expectSelected(townControl, false);
    expectSelected(distanceControl, true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("場所名・住所検索、Google Maps/geocoding、rate-limit UIを提供せずGPSでもfetchしない", () => {
    const view = renderControls();
    const forbiddenSearchUiName =
      /住所|場所名|検索|Google|ジオコーディング|利用制限/;

    expect(view.container.querySelectorAll("input, textarea")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryAllByRole("searchbox")).toHaveLength(0);
    expect(
      screen.queryAllByRole("link", { name: forbiddenSearchUiName }),
    ).toHaveLength(0);
    expect(
      screen.queryAllByRole("button", { name: forbiddenSearchUiName }),
    ).toHaveLength(0);
    expect(screen.queryAllByText(forbiddenSearchUiName)).toHaveLength(0);

    const distanceControl = getControl("button", "近い順に並べる");

    mockGetCurrentPosition.mockImplementationOnce((success) => {
      success(createPosition(35.681236, 139.767125));
    });
    fireEvent.click(distanceControl);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
