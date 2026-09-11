import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationSortControls from "../LocationSortControls";

const CATEGORY_PATH = "/locations/hospital";
const mockRouterReplace = jest.fn();
const mockUsePathname = jest.fn(() => CATEGORY_PATH);
const mockUseSearchParams = jest.fn(() => new URLSearchParams());

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

describe("LocationSortControls nearby-sort visual contract (T089 RED)", () => {
  beforeEach(() => {
    mockRouterReplace.mockReset();
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue(CATEGORY_PATH);
    mockUseSearchParams.mockReset();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("近い順に並べるをprimary Buttonとして、操作領域・focus-visible・状態を公開する", () => {
    render(<LocationSortControls />);

    const nearbySortButton = screen.getByRole("button", {
      name: "近い順に並べる",
    });

    expect(nearbySortButton).toHaveAccessibleName("近い順に並べる");
    expect(nearbySortButton).toHaveAttribute("type", "button");
    expect(nearbySortButton).toHaveAttribute("aria-pressed", "false");
    expect(nearbySortButton).toHaveClass(
      "btn",
      "btn-primary",
      "min-h-[44px]",
      "min-w-[44px]",
    );
    expect(nearbySortButton).toHaveClass(
      "focus-visible:outline",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
    );

    nearbySortButton.focus();
    expect(document.activeElement).toBe(nearbySortButton);
  });
});
