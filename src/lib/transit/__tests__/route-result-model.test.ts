import {
  createRouteResultViewModel,
  type RouteResultData,
} from "../route-result-model";

const ORIGIN = { lat: 35.69, lng: 139.75 };
const DESTINATION = { lat: 35.69, lng: 139.76 };

const journey = {
  from: "乗車バス停",
  to: "降車バス停",
  departure: "10:14:00",
  arrival: "11:03:00",
  duration: 49,
  transfers: 0,
  route: "ルート1",
};

function data(extra: Partial<RouteResultData> = {}): RouteResultData {
  return { journeys: [journey], stops: [], ...extra };
}

describe("createRouteResultViewModelの徒歩距離", () => {
  it("区間ごとの徒歩距離をそのまま引き継ぐ", () => {
    const view = createRouteResultViewModel(
      data({ originWalkMeters: 537, destinationWalkMeters: 120 }),
      ORIGIN,
      DESTINATION,
    );

    expect(view.originWalkMeters).toBe(537);
    expect(view.destinationWalkMeters).toBe(120);
  });

  it("徒歩時間から距離を逆算しない", () => {
    const view = createRouteResultViewModel(
      data({
        stops: [
          {
            id: "origin-stop",
            name: journey.from,
            distance: 0.2,
            walkingTimeMinutes: 6,
          },
        ],
      }),
      ORIGIN,
      DESTINATION,
    );

    expect(view.originWalkMeters).toBeUndefined();
    expect(view.originStop.walkingTimeMinutes).toBe(6);
  });

  it("徒歩距離が無ければundefinedのままにする", () => {
    const view = createRouteResultViewModel(data(), ORIGIN, DESTINATION);

    expect(view.originWalkMeters).toBeUndefined();
    expect(view.destinationWalkMeters).toBeUndefined();
  });
});

describe("createRouteResultViewModelのblockedBy", () => {
  it("経路が無いときもblockedByを引き継ぐ", () => {
    const view = createRouteResultViewModel(
      { journeys: [], stops: [], blockedBy: { field: "destination", meters: 939 } },
      ORIGIN,
      DESTINATION,
    );

    expect(view.hasRoute).toBe(false);
    expect(view.blockedBy).toEqual({ field: "destination", meters: 939 });
  });

  it("blockedByが無ければ欄を作らない", () => {
    const view = createRouteResultViewModel(
      { journeys: [], stops: [] },
      ORIGIN,
      DESTINATION,
    );

    expect(view.blockedBy).toBeUndefined();
  });

  it("経路があるときのblockedByも引き継ぐ", () => {
    const view = createRouteResultViewModel(
      data({ blockedBy: { field: "origin", meters: 800 } }),
      ORIGIN,
      DESTINATION,
    );

    expect(view.hasRoute).toBe(true);
    expect(view.blockedBy).toEqual({ field: "origin", meters: 800 });
  });
});
