import { selectBestRouteCandidate } from "../route-result-ranking";

interface TestRouteCandidate {
  id: string;
  totalWalkingDistance: number;
  departure: string;
  arrival: string;
  transfers: number;
}

const transferCandidate: TestRouteCandidate = {
  id: "transfer",
  totalWalkingDistance: 0.086,
  departure: "10:29:00",
  arrival: "10:55:00",
  transfers: 1,
};

const directCandidate: TestRouteCandidate = {
  id: "direct",
  totalWalkingDistance: 0.086,
  departure: "10:29:00",
  arrival: "11:00:00",
  transfers: 0,
};

const walking = { prioritizeSpeed: false, isDeparture: true };
const speedy = { prioritizeSpeed: true, isDeparture: true };

describe("selectBestRouteCandidate", () => {
  test("徒歩優先では乗換10分のコストで直通が勝つ", () => {
    expect(
      selectBestRouteCandidate([transferCandidate, directCandidate], walking)?.id
    ).toBe("direct");
  });

  test("徒歩優先でも速さの差がコストを上回れば乗換が勝つ", () => {
    const farDirect: TestRouteCandidate = {
      ...directCandidate,
      arrival: "11:30:00",
    };
    expect(
      selectBestRouteCandidate([farDirect, transferCandidate], walking)?.id
    ).toBe("transfer");
  });

  test("はやさ優先では到着の早い乗換が勝つ", () => {
    expect(
      selectBestRouteCandidate([directCandidate, transferCandidate], speedy)?.id
    ).toBe("transfer");
  });

  test("到着時刻指定では遅く出発する経路を選ぶ", () => {
    const arrivalMode = { prioritizeSpeed: false, isDeparture: false };
    const direct: TestRouteCandidate = {
      ...directCandidate,
      departure: "10:35:00",
    };
    const transfer: TestRouteCandidate = {
      ...transferCandidate,
      departure: "10:50:00",
    };
    expect(selectBestRouteCandidate([direct, transfer], arrivalMode)?.id).toBe(
      "transfer"
    );
  });

  test("到着時刻指定のはやさ優先では出発の遅い経路を選ぶ", () => {
    const arrivalMode = { prioritizeSpeed: true, isDeparture: false };
    const early: TestRouteCandidate = {
      ...directCandidate,
      id: "early",
      departure: "10:35:00",
    };
    const late: TestRouteCandidate = {
      ...transferCandidate,
      id: "late",
      departure: "10:50:00",
    };
    expect(selectBestRouteCandidate([early, late], arrivalMode)?.id).toBe("late");
  });

  test("到着と徒歩距離が同じなら乗換回数の少ない経路を選ぶ", () => {
    expect(
      selectBestRouteCandidate(
        [
          { ...transferCandidate, arrival: "11:00:00" },
          directCandidate,
        ],
        walking
      )?.id
    ).toBe("direct");
  });

  test("徒歩距離だけが違えば短い経路を選ぶ", () => {
    const longWalk: TestRouteCandidate = {
      ...directCandidate,
      id: "long-walk",
      totalWalkingDistance: 0.35,
    };
    const shortWalk: TestRouteCandidate = {
      ...directCandidate,
      id: "short-walk",
      totalWalkingDistance: 0.09,
    };
    expect(selectBestRouteCandidate([longWalk, shortWalk], walking)?.id).toBe(
      "short-walk"
    );
  });

  test("候補が空ならundefinedを返す", () => {
    expect(selectBestRouteCandidate([], walking)).toBeUndefined();
  });
});
