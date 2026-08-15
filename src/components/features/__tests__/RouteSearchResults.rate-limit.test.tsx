import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import RouteSearchResults from "../RouteSearchResults";

const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (url: string) => mockRouterPush(url),
  }),
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
  getBusStopMemoData: jest.fn(),
}));
jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => false,
}));

const validSearchParams =
  "origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false";

const mockFetch = global.fetch as jest.Mock;

describe("RouteSearchResults rate-limit contract (T034)", () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockFetch.mockReset();
  });

  it("429 + limitExceeded navigates once to the routes rate-limit page without the old modal", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ success: false, limitExceeded: true }),
    });

    const view = render(<RouteSearchResults searchParams={validSearchParams} />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("利用制限");
      expect(mockRouterPush).toHaveBeenCalledTimes(1);
    });

    expect(mockRouterPush).toHaveBeenCalledWith("/rate-limit?source=routes");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    view.rerender(<RouteSearchResults searchParams={validSearchParams} />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    expect(mockRouterPush).toHaveBeenCalledTimes(1);
  });
});
