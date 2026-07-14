import { calculateArrivalTime, toRouteDisplayModel, UNKNOWN_TIME } from "../route-display-model";

describe("route-display-model", () => {
  it.each([
    ["09:30", 30, "10:00"],
    ["23:50", 30, "00:20"],
    [UNKNOWN_TIME, 30, UNKNOWN_TIME],
    ["invalid", 30, UNKNOWN_TIME],
  ])("calculates arrival time", (departure, duration, expected) => {
    expect(calculateArrivalTime(departure, duration)).toBe(expected);
  });

  it("flattens direct and transfer routes into shared segments", () => {
    const model = toRouteDisplayModel({
      originStop: { stopId: "a", stopName: "A" },
      destinationStop: { stopId: "b", stopName: "B" },
      type: "transfer",
      routes: [{
        routeId: "r1", routeName: "R1", routeShortName: "1", routeLongName: "R1",
        routeColor: "000", routeTextColor: "fff",
        transfers: [{ transferStop: { stopId: "t", stopName: "T" }, nextRoute: {
          routeId: "r2", routeName: "R2", routeShortName: "2", routeLongName: "R2",
          routeColor: "111", routeTextColor: "fff",
        } }],
      }],
    });
    expect(model.segments).toHaveLength(2);
    expect(model.segments[1].transferStop?.stopName).toBe("T");
  });
});
