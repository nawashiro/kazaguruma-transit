import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

export {};

type Coordinates = {
  lat: number;
  lng: number;
};

type ParsedOrigin =
  | { originState: "absent" }
  | { originState: "valid"; origin: Coordinates }
  | { originState: "invalid" };

type PublicFunction = (...args: unknown[]) => unknown;
type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

function loadModule(modulePath: string): ModuleState {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    const loaded: unknown = require(modulePath);
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error(`Expected ${modulePath} to export an object`),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function getPublicFunction(
  state: ModuleState,
  publicName: string,
): PublicFunction {
  const modulePath = "../location-origin-query";

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(`${publicName} is not implemented: public module ${modulePath} exported nothing`);
  }

  const operation = state.exports[publicName];
  if (typeof operation !== "function") {
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} does not export ${publicName}`,
    );
  }
  return operation as PublicFunction;
}

const moduleState = loadModule("../location-origin-query");
const BASE_URL = "https://kazaguruma.invalid";
const CATEGORY_PATH = "/locations/public-facilities";

type MockLinkProps = React.PropsWithChildren<
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
>;

const mockUsePathname = jest.fn<string | null, []>();
const mockUseSearchParams = jest.fn<URLSearchParams, []>();
const mockRouterReplace = jest.fn<void, [string]>();

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({ replace: (href: string) => mockRouterReplace(href) }),
}));

jest.mock("next/link", () => {
  const MockLink = React.forwardRef<HTMLAnchorElement, MockLinkProps>(
    ({ children, href, onClick, ...props }, ref) => {
      const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (event.defaultPrevented) {
          return;
        }

        const destination = new URL(href, BASE_URL);
        window.history.pushState(
          {},
          "",
          `${destination.pathname}${destination.search}${destination.hash}`,
        );
      };

      return React.createElement(
        "a",
        { ...props, ref, href, onClick: handleClick },
        children,
      );
    },
  );
  MockLink.displayName = "MockLink";

  return {
    __esModule: true,
    default: MockLink,
  };
});

function parseOrigin(value: string | null | undefined): ParsedOrigin {
  const parseLocationOrigin = getPublicFunction(moduleState, "parseLocationOrigin");
  return parseLocationOrigin(value) as ParsedOrigin;
}

function isPublicModule(value: unknown): value is PublicModule {
  return typeof value === "object" && value !== null;
}

function loadLocationSortControls(): React.ComponentType {
  const modulePath = "../../../components/features/LocationSortControls";
  let loaded: unknown = null;
  let loadError: unknown = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    loaded = require(modulePath);
  } catch (error) {
    loadError = error;
  }

  expect(loadError).toBeNull();
  expect(isPublicModule(loaded)).toBe(true);
  if (!isPublicModule(loaded)) {
    throw new Error(`Expected ${modulePath} to export a public module`);
  }

  const component = loaded.default;
  expect(typeof component).toBe("function");
  return component as React.ComponentType;
}

function renderOriginControls(rawOrigin: string): void {
  window.history.replaceState(
    {},
    "",
    `${CATEGORY_PATH}?origin=${encodeURIComponent(rawOrigin)}`,
  );
  mockUsePathname.mockReturnValue(CATEGORY_PATH);
  mockUseSearchParams.mockReturnValue(
    new URLSearchParams({ origin: rawOrigin }),
  );

  const LocationSortControls = loadLocationSortControls();
  render(React.createElement(LocationSortControls));
}

function getTownResetLink(): HTMLAnchorElement {
  const link = screen.queryByRole("link", { name: "町字で並べる" });
  expect(link).toBeInTheDocument();
  return link as HTMLAnchorElement;
}

describe("location origin query", () => {
  it("URL queryのoriginを緯度・経度の順で解釈する", () => {
    const currentUrl = new URL(
      "/locations/public-facilities?origin=35.681236%2C139.767125",
      BASE_URL,
    );

    const result = parseOrigin(currentUrl.searchParams.get("origin"));

    expect(result).toMatchObject({
      originState: "valid",
      origin: { lat: 35.681236, lng: 139.767125 },
    });
  });

  it("originを緯度,経度へ直列化し、同じ座標へ復元できる", () => {
    const serializeLocationOrigin = getPublicFunction(
      moduleState,
      "serializeLocationOrigin",
    );
    const origin = { lat: 35.681236, lng: 139.767125 };
    const serialized = serializeLocationOrigin(origin);

    expect(serialized).toBe("35.681236,139.767125");
    expect(parseOrigin(serialized as string)).toMatchObject({
      originState: "valid",
      origin,
    });
    expect(new URLSearchParams({ origin: serialized as string }).toString()).toBe(
      "origin=35.681236%2C139.767125",
    );
  });

  it("千代田区外でも有限な緯度・経度を有効なoriginとして受け入れる", () => {
    const result = parseOrigin("51.5074,-0.1278");

    expect(result).toMatchObject({
      originState: "valid",
      origin: { lat: 51.5074, lng: -0.1278 },
    });
  });

  it.each([
    ["緯度・経度の区切りがない", "35.681236"],
    ["緯度がNaN", "NaN,139.767125"],
    ["経度がNaN", "35.681236,NaN"],
    ["数値でない文字列", "35.681236,not-a-number"],
    ["無限大", "Infinity,139.767125"],
    ["空のorigin値", ""],
  ] as const)("%sをinvalidとして扱う", (_label, rawOrigin) => {
    const result = parseOrigin(rawOrigin);

    expect(result).toMatchObject({ originState: "invalid" });
    expect(result).not.toHaveProperty("origin");
  });

  it.each([undefined, null])(
    "originがクエリにない場合はabsentとして扱う: %p",
    (rawOrigin) => {
      const result = parseOrigin(rawOrigin);

      expect(result).toMatchObject({ originState: "absent" });
      expect(result).not.toHaveProperty("origin");
    },
  );

});

describe("location origin reset negative contract", () => {
  let originalBrowserUrl = "/";

  beforeEach(() => {
    originalBrowserUrl =
      window.location.pathname + window.location.search + window.location.hash;
    window.history.replaceState({}, "", "/");
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue(CATEGORY_PATH);
    mockUseSearchParams.mockReset();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    mockRouterReplace.mockReset();
  });

  afterEach(() => {
    window.history.replaceState({}, "", originalBrowserUrl);
  });

  it("validなoriginはreset選択前に保持し、町字で並べる選択後だけ除去する", () => {
    const serializeLocationOrigin = getPublicFunction(
      moduleState,
      "serializeLocationOrigin",
    );
    const origin = { lat: 35.681236, lng: 139.767125 };
    const serializedOrigin = serializeLocationOrigin(origin) as string;

    renderOriginControls(serializedOrigin);

    const beforeReset = new URL(window.location.href);
    expect(beforeReset.pathname).toBe(CATEGORY_PATH);
    expect(beforeReset.searchParams.get("origin")).toBe(serializedOrigin);
    expect(parseOrigin(beforeReset.searchParams.get("origin"))).toMatchObject({
      originState: "valid",
      origin,
    });

    const resetLink = getTownResetLink();
    const resetHref = new URL(resetLink.getAttribute("href") ?? "", BASE_URL);
    expect(resetHref.pathname).toBe(CATEGORY_PATH);
    expect(resetHref.search).toBe("");
    expect(new URL(window.location.href).searchParams.get("origin")).toBe(
      serializedOrigin,
    );

    fireEvent.click(resetLink);

    const afterReset = new URL(window.location.href);
    expect(afterReset.pathname).toBe(CATEGORY_PATH);
    expect(afterReset.search).toBe("");
    expect(parseOrigin(afterReset.searchParams.get("origin"))).toMatchObject({
      originState: "absent",
    });
  });

  it("invalidなoriginもreset選択前に保持し、町字で並べる選択後だけ除去する", () => {
    const rawOrigin = "NaN,139.767125";

    renderOriginControls(rawOrigin);

    const beforeReset = new URL(window.location.href);
    expect(beforeReset.pathname).toBe(CATEGORY_PATH);
    expect(beforeReset.searchParams.get("origin")).toBe(rawOrigin);
    expect(parseOrigin(beforeReset.searchParams.get("origin"))).toMatchObject({
      originState: "invalid",
    });
    expect(parseOrigin(beforeReset.searchParams.get("origin"))).not.toHaveProperty(
      "origin",
    );

    const resetLink = getTownResetLink();
    const resetHref = new URL(resetLink.getAttribute("href") ?? "", BASE_URL);
    expect(resetHref.pathname).toBe(CATEGORY_PATH);
    expect(resetHref.search).toBe("");
    expect(new URL(window.location.href).searchParams.get("origin")).toBe(
      rawOrigin,
    );

    fireEvent.click(resetLink);

    const afterReset = new URL(window.location.href);
    expect(afterReset.pathname).toBe(CATEGORY_PATH);
    expect(afterReset.search).toBe("");
    expect(parseOrigin(afterReset.searchParams.get("origin"))).toMatchObject({
      originState: "absent",
    });
  });
});
