import {
  calculateGridWalkingDistanceKm,
  calculateJourneyDurationMinutes,
  calculateRouteSearchTime,
  calculateWalkingTimeMinutes,
} from "../walking";

describe("walking", () => {
  test("直線距離を碁盤目上の最悪距離に補正する", () => {
    expect(calculateGridWalkingDistanceKm(1)).toBeCloseTo(Math.SQRT2);
  });

  test("補正後の距離から徒歩時間を計算する", () => {
    expect(calculateWalkingTimeMinutes(1, 3)).toBeCloseTo(
      Math.SQRT2 * 20
    );
  });

  test("出発時刻指定では最初のバスを待つ時間も総所要時間に含める", () => {
    expect(
      calculateJourneyDurationMinutes({
        isDeparture: true,
        requestedTime: "09:00:00",
        transitDepartureTime: "09:20:00",
        transitArrivalTime: "09:50:00",
        walkToFirstStopMinutes: 10,
        walkFromLastStopMinutes: 5,
      })
    ).toBe(55);
  });

  test("到着時刻指定では両端の徒歩を総所要時間に含める", () => {
    expect(
      calculateJourneyDurationMinutes({
        isDeparture: false,
        requestedTime: "10:00:00",
        transitDepartureTime: "09:20:00",
        transitArrivalTime: "09:50:00",
        walkToFirstStopMinutes: 10,
        walkFromLastStopMinutes: 5,
      })
    ).toBe(45);
  });

  test("検索時刻を出発側または到着側の徒歩ぶん補正する", () => {
    const requestedTime = new Date(2026, 6, 20, 10, 0);

    expect(
      calculateRouteSearchTime(requestedTime, true, 10, 5).getTime()
    ).toBe(new Date(2026, 6, 20, 10, 10).getTime());
    expect(
      calculateRouteSearchTime(requestedTime, false, 10, 5).getTime()
    ).toBe(new Date(2026, 6, 20, 9, 55).getTime());
  });
});
