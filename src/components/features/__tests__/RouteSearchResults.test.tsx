import { render, screen } from "@testing-library/react";
import RouteSearchResults from "../RouteSearchResults";
import { createRouteResultViewModel } from "@/lib/transit/route-result-model";

jest.mock("../RouteResultActions", () => function Actions() { return <button>PDF</button>; });
const query = { origin: { lat: 35, lng: 139 }, destination: { lat: 36, lng: 140 }, time: "2026-07-18T09:30", isDeparture: true, prioritizeSpeed: false };

it("経路なしの静的本文と入力画面リンクを表示しブラウザ取得しない", () => {
  global.fetch = jest.fn();
  render(<RouteSearchResults result={{ status: "success", query, routeInfo: createRouteResultViewModel(undefined, query.origin, query.destination) }} />);
  expect(screen.getByRole("heading", { name: "ルートが見つかりません" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "入力画面に戻る" })).toHaveAttribute("href", "/");
  expect(screen.queryByRole("button")).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});
