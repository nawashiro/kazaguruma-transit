import { render, screen } from "@testing-library/react";
import RouteSearchResults from "../RouteSearchResults";
import { createRouteResultViewModel } from "@/lib/transit/route-result-model";

jest.mock("../RouteResultActions", () => function Actions() { return <button>PDF</button>; });
const query = { origin: { lat: 35, lng: 139 }, destination: { lat: 36, lng: 140 }, time: "2026-07-18T09:30", isDeparture: true, prioritizeSpeed: false };

it("経路なしの静的本文と入力画面リンクを表示しブラウザ取得しない", () => {
  global.fetch = jest.fn();
  render(<RouteSearchResults result={{ status: "success", query, routeInfo: createRouteResultViewModel(undefined, query.origin, query.destination) }} />);
  expect(screen.getByRole("heading", { name: "ルートが見つかりません" })).toBeInTheDocument();
  expect(screen.queryByRole("button")).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});



it("停留所の徒歩時間は直線距離からではなく経路検索の値を使う", () => {
  const data = {
    journeys: [
      {
        departure: "09:30:00",
        arrival: "10:15:00",
        duration: 45,
        transfers: 0,
        from: "出発バス停",
        to: "到着バス停",
      },
    ],
    stops: [
      { id: "origin", name: "出発バス停", distance: 0.2, walkingTimeMinutes: 6 },
      { id: "destination", name: "到着バス停", distance: 0.3, walkingTimeMinutes: 9 },
    ],
  };
  const routeInfo = createRouteResultViewModel(data, query.origin, query.destination);

  expect(routeInfo.originStop.walkingTimeMinutes).toBe(6);
  expect(routeInfo.destinationStop.walkingTimeMinutes).toBe(9);
  expect(routeInfo.originStop.distance).toBe(0.2);
});
