import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RouteSearchResults from "../RouteSearchResults";

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock(
  "@/components/features/IntegratedRouteDisplay",
  () => function MockIntegratedRouteDisplay() {
    return <div data-testid="mock-route-display" />;
  },
);
jest.mock(
  "@/components/features/RoutePdfExport",
  () => function MockRoutePdfExport() {
    return <div data-testid="mock-pdf-export" />;
  },
);
jest.mock(
  "@/components/features/RouteCalendarExport",
  () => function MockRouteCalendarExport() {
    return <div data-testid="mock-calendar-export" />;
  },
);
jest.mock("@/components/discussion", () => ({
  BusStopDiscussion: () => <div data-testid="mock-bus-stop-discussion" />,
  BusStopMemo: () => <div data-testid="mock-bus-stop-memo" />,
  getBusStopMemoData: jest.fn().mockResolvedValue(new Map()),
}));
jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => false,
}));

const validSearchParams =
  "origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false";

describe("RouteSearchResults loading contract (Issue #128)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(() => new Promise<Response>(() => undefined));
  });

  it("loadingのRuby境界を検索テキストだけに限定しDaisyUI spinnerを維持する", () => {
    render(<RouteSearchResults searchParams={validSearchParams} />);

    const status = screen.getByRole("status");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveClass("ruby-text");

    const spinner = status.querySelector<HTMLSpanElement>("span.loading.loading-spinner");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass("loading-lg");
    expect(spinner).toHaveAttribute("aria-hidden", "true");
    expect(spinner).not.toHaveClass("ruby-text");

    const rubyBoundaries = Array.from(status.children).filter((child) =>
      child.classList.contains("ruby-text"),
    );
    expect(rubyBoundaries).toHaveLength(1);
    const searchText = rubyBoundaries[0];
    expect(searchText).toHaveTextContent("経路を検索中...");
    expect(searchText?.textContent).toBe("経路を検索中...");
    expect(searchText?.contains(spinner)).toBe(false);
    expect(spinner?.closest(".ruby-text")).toBeNull();

    const directTextNodes = Array.from(status.childNodes).filter(
      (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
    );
    expect(directTextNodes).toEqual([]);
  });
});
