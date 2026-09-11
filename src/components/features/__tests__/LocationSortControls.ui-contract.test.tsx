import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationSortControls from "../LocationSortControls";

const CATEGORY_PATH = "/locations/hospital";
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
  useRouter: () => ({
    replace: (href: string) => mockRouterReplace(href),
  }),
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

const SHARED_BUTTON_CLASSES = [
  "btn",
  "btn-primary",
  "text-base",
  "ruby-text",
  "gap-0",
  "rounded-full",
  "dark:rounded-sm",
  "min-h-[44px]",
  "min-w-[44px]",
  "leading-relaxed",
  "font-medium",
  "inline-flex",
  "items-center",
  "justify-center",
] as const;

const FOCUS_VISIBLE_CLASSES = [
  "focus-visible:outline",
  "focus-visible:outline-2",
  "focus-visible:outline-offset-2",
] as const;

const FULL_WIDTH_CLASSES = [
  "w-full",
  "self-stretch",
  "basis-full",
  "sm:w-full",
  "sm:self-stretch",
  "sm:basis-full",
] as const;

function createPositionError(code: 1 | 2 | 3): GeolocationPositionError {
  return {
    code,
    message: "test geolocation error",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

function renderControls(): void {
  mockUsePathname.mockReturnValue(CATEGORY_PATH);
  mockUseSearchParams.mockReturnValue(new URLSearchParams());
  render(<LocationSortControls />);
}

describe("LocationSortControls UI contract (T096 RED)", () => {
  let originalGeolocationDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
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
  });

  it("町字リンクと近い順ボタンが同じButton視覚語彙・44px操作領域・可視focusを持つ", () => {
    renderControls();

    const townLink = screen.getByRole("link", { name: "町字で並べる" });
    const nearbyButton = screen.getByRole("button", {
      name: "近い順に並べる",
    });

    expect(townLink).toHaveAttribute("href", CATEGORY_PATH);
    expect(townLink).toHaveAttribute("aria-current", "page");
    expect(nearbyButton).toHaveAttribute("type", "button");
    expect(nearbyButton).toHaveAttribute("aria-pressed", "false");

    [townLink, nearbyButton].forEach((control) => {
      expect(control).toHaveClass(...SHARED_BUTTON_CLASSES);
      expect(control).toHaveClass(...FOCUS_VISIBLE_CLASSES);

      control.focus();
      expect(document.activeElement).toBe(control);
    });
  });

  it("GPS拒否を実際に操作するとalertを操作行の外へ全幅で表示し、既存状態と非fetch契約を保つ", async () => {
    renderControls();

    const townLink = screen.getByRole("link", { name: "町字で並べる" });
    const nearbyButton = screen.getByRole("button", {
      name: "近い順に並べる",
    });
    const operationRow = townLink.parentElement;

    if (!operationRow) {
      throw new Error("sort controls must have an operation-row parent");
    }

    expect(operationRow).toContainElement(nearbyButton);
    expect(operationRow).toHaveClass("sm:flex-row");

    mockGetCurrentPosition.mockImplementationOnce((_success, error) => {
      error?.(createPositionError(1));
    });
    fireEvent.click(nearbyButton);

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
    const alert = await waitFor(() => screen.getByRole("alert"));

    expect(alert).toHaveClass(
      "alert",
      "alert-error",
      "alert-soft",
      "text-base-content!",
    );
    expect(alert).toHaveTextContent(
      "位置情報の利用が許可されませんでした。GPSの権限を確認してください。",
    );
    expect(alert).toHaveTextContent("エラー");
    expect(alert.parentElement).not.toBe(operationRow);
    expect(operationRow).not.toContainElement(alert);
    expect(
      FULL_WIDTH_CLASSES.some((className) => alert.classList.contains(className)),
    ).toBe(true);

    expect(townLink).toHaveAttribute("aria-current", "page");
    expect(nearbyButton).toHaveAttribute("aria-pressed", "false");
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
