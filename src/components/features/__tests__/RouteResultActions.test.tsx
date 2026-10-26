import { render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server.node";
import RouteResultActions from "../RouteResultActions";
import { BusStopMemo, BusStopDiscussion, getBusStopMemoData } from "@/components/discussion";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import { createRouteResultViewModel } from "@/lib/transit/route-result-model";
import type { PostWithStats } from "@/types/discussion";

const mockPdf = jest.fn();
const mockCalendar = jest.fn();
jest.mock("@/components/features/RoutePdfExport", () => function Pdf(props: unknown) { mockPdf(props); return <button>PDF</button>; });
jest.mock("@/components/features/RouteCalendarExport", () => function Calendar(props: unknown) { mockCalendar(props); return <button>カレンダー</button>; });
jest.mock("@/components/discussion", () => ({
  getBusStopMemoData: jest.fn(),
  BusStopMemo: jest.fn(() => <div>メモ</div>),
  BusStopDiscussion: jest.fn(() => <div>掲示板</div>),
}));
jest.mock("@/lib/config/discussion-config", () => ({ isDiscussionsEnabled: jest.fn() }));
const query = { origin: { lat: 35, lng: 139 }, destination: { lat: 36, lng: 140 }, time: "2026-07-18T09:30", isDeparture: true, prioritizeSpeed: false };
const routeInfo = createRouteResultViewModel({ journeys: [{ from: "始発", to: "終点", departure: "09:30", arrival: "10:00", duration: 30, transfers: 0, route: "路線" }], stops: [] }, query.origin, query.destination);

describe("独立したクライアント出力操作", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(BusStopMemo).mockImplementation(() => <div>メモ</div>);
    jest.mocked(BusStopDiscussion).mockImplementation(() => <div>掲示板</div>);
    jest.mocked(isDiscussionsEnabled).mockReturnValue(true);
    global.fetch = jest.fn();
  });
  it("Nostrが保留中でも出力操作へシリアライズ可能な経路を渡す", () => {
    jest.mocked(getBusStopMemoData).mockReturnValue(new Promise(() => undefined));
    render(<RouteResultActions routeInfo={routeInfo} query={query} />);
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "カレンダー" })).toBeInTheDocument();
    expect(mockPdf).toHaveBeenLastCalledWith(expect.objectContaining({ routes: routeInfo.routes, selectedDateTime: query.time, originLat: 35, destLng: 140, memoData: new Map() }));
    expect(mockCalendar).toHaveBeenLastCalledWith(expect.objectContaining({ routes: routeInfo.routes, selectedDateTime: query.time }));
    expect(JSON.parse(JSON.stringify({ routeInfo, query }))).toEqual({ routeInfo, query });
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it("Nostrの失敗で出力を隠さない", async () => {
    jest.mocked(getBusStopMemoData).mockRejectedValue(new Error("Nostr"));
    render(<RouteResultActions routeInfo={routeInfo} query={query} />);
    await waitFor(() => expect(getBusStopMemoData).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "カレンダー" })).toBeInTheDocument();
  });
  it.each([BusStopMemo, BusStopDiscussion])("Nostr子要素の描画失敗を経路本文と出力操作から隔離する", async (component) => {
    jest.mocked(getBusStopMemoData).mockReturnValue(new Promise(() => undefined));
    jest.mocked(component).mockImplementation(() => { throw new Error("Nostr render"); });
    render(<><p>経路本文</p><a href="https://maps.google.com">地図</a><RouteResultActions routeInfo={routeInfo} query={query} /></>);
    expect(await screen.findByRole("status")).toHaveTextContent("停留所のメモ・掲示板を表示できません");
    expect(screen.getByText("経路本文")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "地図" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "カレンダー" })).toBeInTheDocument();
    expect(mockPdf).toHaveBeenLastCalledWith(expect.objectContaining({ routes: routeInfo.routes }));
  });
  it("同期的なメモ初期化の失敗でも出力を保持する", async () => {
    jest.mocked(getBusStopMemoData).mockImplementation(() => { throw new Error("Nostr init"); });
    render(<RouteResultActions routeInfo={routeInfo} query={query} />);
    await waitFor(() => expect(getBusStopMemoData).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "カレンダー" })).toBeInTheDocument();
  });
  it("サーバー描画ではNostr子要素を初期化も描画もしない", () => {
    jest.mocked(BusStopMemo).mockImplementation(() => { throw new Error("SSR Nostr"); });
    jest.mocked(BusStopDiscussion).mockImplementation(() => { throw new Error("SSR Nostr"); });
    const html = renderToStaticMarkup(<><p>経路本文</p><RouteResultActions routeInfo={routeInfo} query={query} /></>);
    expect(html).toContain("経路本文");
    expect(html).toContain("PDF");
    expect(html).toContain("カレンダー");
    expect(BusStopMemo).not.toHaveBeenCalled();
    expect(BusStopDiscussion).not.toHaveBeenCalled();
    expect(getBusStopMemoData).not.toHaveBeenCalled();
  });
  it("取得したメモをPDFへ渡す", async () => {
    const memos = new Map<string, PostWithStats>();
    memos.set("始発", { id: "memo" } as PostWithStats);
    jest.mocked(getBusStopMemoData).mockResolvedValue(memos);
    render(<RouteResultActions routeInfo={routeInfo} query={query} />);
    await waitFor(() => expect(mockPdf).toHaveBeenLastCalledWith(expect.objectContaining({ memoData: memos })));
    expect(getBusStopMemoData).toHaveBeenCalledWith(["始発", "終点"]);
  });
  it("掲示板無効ならNostrを開始せず出力だけ表示する", () => {
    jest.mocked(isDiscussionsEnabled).mockReturnValue(false);
    render(<RouteResultActions routeInfo={routeInfo} query={query} />);
    expect(getBusStopMemoData).not.toHaveBeenCalled();
    expect(screen.queryByText("掲示板")).toBeNull();
    expect(BusStopMemo).not.toHaveBeenCalled();
    expect(BusStopDiscussion).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "カレンダー" })).toBeInTheDocument();
  });
});
