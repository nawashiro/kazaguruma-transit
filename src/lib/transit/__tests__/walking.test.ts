import {
  calculateJourneyDurationMinutes,
  calculateRouteSearchTime,
  calculateWalkingTimeMinutes,
} from "../walking";

describe("walking", () => {
  test("徒歩距離をそのまま歩行速度で割って徒歩時間にする", () => {
    expect(calculateWalkingTimeMinutes(1, 3)).toBeCloseTo(20);
  });

  test("600メートルの徒歩は時速3キロメートルで12分になる", () => {
    expect(calculateWalkingTimeMinutes(0.6, 3)).toBeCloseTo(12);
  });

  test("距離に補正係数を掛け直さない", () => {
    expect(calculateWalkingTimeMinutes(1, 3)).not.toBeCloseTo(
      Math.SQRT2 * 20
    );
  });

  test("歩行速度が0以下なら拒否する", () => {
    expect(() => calculateWalkingTimeMinutes(0.5, 0)).toThrow(
      "歩行速度は0より大きい必要があります"
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
