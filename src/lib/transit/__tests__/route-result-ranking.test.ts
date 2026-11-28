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
const arrivalMode = { prioritizeSpeed: false, isDeparture: false };
const arrivalSpeedy = { prioritizeSpeed: true, isDeparture: false };

describe("selectBestRouteCandidate", () => {
  test("徒歩優先では乗換が5分早いだけなら直通を選ぶ", () => {
    expect(
      selectBestRouteCandidate([transferCandidate, directCandidate], walking)?.id
    ).toBe("direct");
  });

  test("徒歩優先でも乗換の到着が35分早ければ乗換を選ぶ", () => {
    const farDirect: TestRouteCandidate = {
      ...directCandidate,
      arrival: "11:30:00",
    };
    expect(
      selectBestRouteCandidate([farDirect, transferCandidate], walking)?.id
    ).toBe("transfer");
  });

  test("乗換の到着がちょうど30分早ければ乗換を選ぶ", () => {
    const boundaryDirect: TestRouteCandidate = {
      ...directCandidate,
      arrival: "11:25:00",
    };
    expect(
      selectBestRouteCandidate([boundaryDirect, transferCandidate], walking)?.id
    ).toBe("transfer");
  });

  test("直通がなければ乗換を選ぶ", () => {
    expect(selectBestRouteCandidate([transferCandidate], walking)?.id).toBe(
      "transfer"
    );
  });

  test("はやさ優先では到着の早い乗換を選ぶ", () => {
    expect(
      selectBestRouteCandidate([directCandidate, transferCandidate], speedy)?.id
    ).toBe("transfer");
  });

  test("はやさ優先では直通の方が早ければ直通を選ぶ", () => {
    const earlyDirect: TestRouteCandidate = {
      ...directCandidate,
      arrival: "10:50:00",
    };
    expect(
      selectBestRouteCandidate([earlyDirect, transferCandidate], speedy)?.id
    ).toBe("direct");
  });

  test("到着時刻指定では乗換が15分しか遅く出発できないなら直通を選ぶ", () => {
    const direct: TestRouteCandidate = {
      ...directCandidate,
      departure: "10:35:00",
    };
    const transfer: TestRouteCandidate = {
      ...transferCandidate,
      departure: "10:50:00",
    };
    expect(selectBestRouteCandidate([direct, transfer], arrivalMode)?.id).toBe(
      "direct"
    );
  });

  test("到着時刻指定では乗換が45分遅く出発できるなら乗換を選ぶ", () => {
    const direct: TestRouteCandidate = {
      ...directCandidate,
      departure: "09:50:00",
    };
    const transfer: TestRouteCandidate = {
      ...transferCandidate,
      departure: "10:35:00",
    };
    expect(selectBestRouteCandidate([direct, transfer], arrivalMode)?.id).toBe(
      "transfer"
    );
  });

  test("到着時刻指定のはやさ優先では出発の遅い経路を選ぶ", () => {
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
    expect(selectBestRouteCandidate([early, late], arrivalSpeedy)?.id).toBe(
      "late"
    );
  });

  test("到着と徒歩距離が同じなら乗換回数の少ない経路を選ぶ", () => {
    expect(
      selectBestRouteCandidate(
        [{ ...transferCandidate, arrival: "11:00:00" }, directCandidate],
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
