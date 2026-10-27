import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server.node";
import RouteResultActions from "../RouteResultActions";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import { createRouteResultViewModel } from "@/lib/transit/route-result-model";

const mockInitializeDiscussion = jest.fn();
jest.mock("@/components/discussion", () => {
  mockInitializeDiscussion();
  throw new Error("Nostr module initialization");
});
jest.mock("@/components/features/RoutePdfExport", () => function Pdf() { return <button>PDF</button>; });
jest.mock("@/components/features/RouteCalendarExport", () => function Calendar() { return <button>カレンダー</button>; });
jest.mock("@/lib/config/discussion-config", () => ({ isDiscussionsEnabled: jest.fn() }));

const query = { origin: { lat: 35, lng: 139 }, destination: { lat: 36, lng: 140 }, time: "2026-07-18T09:30", isDeparture: true, prioritizeSpeed: false };
const routeInfo = createRouteResultViewModel({ journeys: [{ from: "始発", to: "終点", departure: "09:30", arrival: "10:00", duration: 30, transfers: 0, route: "路線" }], stops: [] }, query.origin, query.destination);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(isDiscussionsEnabled).mockReturnValue(true);
});

it("サーバー描画でNostrモジュールを読み込まない", () => {
  const html = renderToStaticMarkup(<><p>経路本文</p><RouteResultActions routeInfo={routeInfo} query={query} /></>);
  expect(html).toContain("経路本文");
  expect(html).toContain("PDF");
  expect(html).toContain("カレンダー");
  expect(mockInitializeDiscussion).not.toHaveBeenCalled();
});

it("無効設定ではマウントしてもNostrモジュールを読み込まない", () => {
  jest.mocked(isDiscussionsEnabled).mockReturnValue(false);
  render(<RouteResultActions routeInfo={routeInfo} query={query} />);
  expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "カレンダー" })).toBeInTheDocument();
  expect(mockInitializeDiscussion).not.toHaveBeenCalled();
});

it("マウント後のNostrモジュール初期化失敗を本文と出力操作から隔離する", async () => {
  render(<><p>経路本文</p><RouteResultActions routeInfo={routeInfo} query={query} /></>);
  expect(await screen.findByRole("status")).toHaveTextContent("停留所のメモ・掲示板を表示できません");
  expect(mockInitializeDiscussion).toHaveBeenCalled();
  expect(screen.getByText("経路本文")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "カレンダー" })).toBeInTheDocument();
});
