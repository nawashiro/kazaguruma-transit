/* eslint-disable react/display-name */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import RoutesPage from "../page";

let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/components/features/IntegratedRouteDisplay", () => () => (
  <div data-testid="mock-route-display" />
));
jest.mock("@/components/features/RoutePdfExport", () => () => (
  <div data-testid="mock-pdf-export" />
));
jest.mock("@/components/features/RouteCalendarExport", () => () => (
  <div data-testid="mock-calendar-export" />
));
jest.mock("@/components/discussion", () => ({
  BusStopDiscussion: () => <div data-testid="mock-bus-stop-discussion" />,
  BusStopMemo: () => <div data-testid="mock-bus-stop-memo" />,
  getBusStopMemoData: jest.fn().mockResolvedValue(new Map()),
}));
jest.mock("@/lib/config/discussion-config", () => ({
  isDiscussionsEnabled: () => true,
}));
jest.mock("@/components/features/RateLimitModal", () =>
  ({ isOpen }: any) => (isOpen ? <div data-testid="mock-rate-limit-modal" /> : null),
);

const validSearch =
  "origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false";

const successfulResponse = {
  success: true,
  data: {
    journeys: [
      {
        departure: "09:00",
        arrival: "09:15",
        duration: 15,
        transfers: 0,
        route: "テスト路線",
        from: "出発バス停",
        to: "到着バス停",
      },
    ],
    stops: [
      { id: "origin", name: "出発バス停", distance: 100, lat: 35.681, lng: 139.761 },
      { id: "destination", name: "到着バス停", distance: 200, lat: 35.701, lng: 139.781 },
    ],
  },
};

describe("RoutesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams(validSearch);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => successfulResponse,
    });
  });

  it("URLの全条件をGET APIへ渡して結果と出力機能を表示する", async () => {
    render(<RoutesPage />);

    expect(screen.getByRole("status")).toHaveTextContent("経路を検索中");
    expect(await screen.findByTestId("mock-route-display")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/transit?type=route&origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
      expect.objectContaining({ method: "GET" }),
    );
    expect(screen.getByTestId("mock-calendar-export")).toBeInTheDocument();
    expect(screen.getByTestId("mock-pdf-export")).toBeInTheDocument();
    expect(screen.getByTestId("mock-bus-stop-memo")).toBeInTheDocument();
    expect(screen.getByTestId("mock-bus-stop-discussion")).toBeInTheDocument();
  });

  it("不正なURLではfetchせず日本語エラーと入力ページへの導線を表示する", () => {
    mockSearchParams = new URLSearchParams("origin=91%2C139.76");

    render(<RoutesPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("検索条件");
    expect(screen.getByRole("link", { name: "検索条件を変更" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("経路なしも結果ページ内の既存表示へ渡す", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { journeys: [], stops: [] } }),
    });

    render(<RoutesPage />);

    expect(await screen.findByTestId("mock-route-display")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-pdf-export")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-calendar-export")).not.toBeInTheDocument();
  });

  it("APIエラーを日本語で表示して入力ページへ戻せる", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: "経路APIエラー" }),
    });

    render(<RoutesPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("経路APIエラー");
    expect(screen.getByRole("link", { name: "検索条件を変更" })).toBeInTheDocument();
  });

  it("429を既存のレート制限モーダルへ接続する", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ success: false, limitExceeded: true }),
    });

    render(<RoutesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-rate-limit-modal")).toBeInTheDocument();
    });
  });
});
