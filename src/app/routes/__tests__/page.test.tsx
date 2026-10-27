import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server.node";
import RoutesPage from "../page";
import { searchRoutes } from "@/lib/transit/search-routes";
import { createRouteResultViewModel } from "@/lib/transit/route-result-model";

jest.mock("@/lib/transit/search-routes", () => ({ searchRoutes: jest.fn() }));
jest.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "192.0.2.1" }) }));
jest.mock("next/navigation", () => ({ redirect: jest.fn((href: string) => { throw new Error(`redirect:${href}`); }) }));
jest.mock("@/components/features/RouteResultActions", () => function Actions() { return <div data-testid="actions" />; });
const query = { origin: { lat: 35, lng: 139 }, destination: { lat: 36, lng: 140 }, time: "2026-07-18T09:30", isDeparture: true, prioritizeSpeed: false };
function success(name = "サーバー路線") {
  return { status: "success" as const, query, routeInfo: createRouteResultViewModel({ journeys: [{ from: "始発", to: "終点", departure: "09:30", arrival: "10:00", duration: 30, transfers: 0, route: name }], stops: [] }, query.origin, query.destination) };
}

describe("RoutesPage server HTML", () => {
  beforeEach(() => { jest.clearAllMocks(); jest.mocked(searchRoutes).mockResolvedValue(success()); global.fetch = jest.fn(); });
  it("URLの重複値を保ってサーバー検索しHTMLに本文を含める", async () => {
    const element = await RoutesPage({ searchParams: Promise.resolve({ origin: ["invalid", "35,139"], time: query.time }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("サーバー路線");
    expect(html).toContain("始発");
    expect(searchRoutes).toHaveBeenCalledTimes(1);
    expect(jest.mocked(searchRoutes).mock.calls[0][0].getAll("origin")).toEqual(["invalid", "35,139"]);
    expect(jest.mocked(searchRoutes).mock.calls[0][1].get("x-forwarded-for")).toBe("192.0.2.1");
    render(element);
    expect(screen.getByRole("link", { name: "入力画面に戻る" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("検索条件をリセット")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it("リクエストごとに異なる結果を描画する", async () => {
    const first = renderToStaticMarkup(await RoutesPage({ searchParams: Promise.resolve({ time: "first" }) }));
    jest.mocked(searchRoutes).mockResolvedValue(success("別の路線"));
    const second = renderToStaticMarkup(await RoutesPage({ searchParams: Promise.resolve({ time: "second" }) }));
    expect(first).not.toContain("別の路線");
    expect(second).toContain("別の路線");
    expect(second).not.toContain("サーバー路線");
  });
  it("条件不正・検索失敗はサーバーのエラーと戻るリンクを表示する", async () => {
    jest.mocked(searchRoutes).mockResolvedValue({ status: "error", message: "検索条件が正しくありません" });
    render(await RoutesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("alert")).toHaveTextContent("検索条件");
    expect(screen.getByRole("link", { name: "入力画面に戻る" })).toBeInTheDocument();
  });
  it("経路なしもHTML表示し出力操作は付けない", async () => {
    jest.mocked(searchRoutes).mockResolvedValue({ status: "success", query, routeInfo: createRouteResultViewModel(undefined, query.origin, query.destination) });
    render(await RoutesPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText("ルートが見つかりません")).toBeInTheDocument();
    expect(screen.queryByTestId("actions")).toBeNull();
  });
  it("制限時はredirectを検索エラーとして捕捉しない", async () => {
    jest.mocked(searchRoutes).mockResolvedValue({ status: "limited" });
    await expect(RoutesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/rate-limit?source=routes");
  });
});
