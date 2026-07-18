import { selectBestRouteCandidate } from "../route-result-ranking";

interface TestRouteCandidate {
  id: string;
  totalWalkingDistance: number;
  totalDuration: number;
}

const candidates: TestRouteCandidate[] = [
  { id: "fast", totalWalkingDistance: 0.8, totalDuration: 20 },
  { id: "short-walk", totalWalkingDistance: 0.2, totalDuration: 35 },
];

describe("selectBestRouteCandidate", () => {
  test("はやさ優先がオンなら所要時間が最短の経路を選ぶ", () => {
    expect(selectBestRouteCandidate(candidates, true)?.id).toBe("fast");
  });

  test("はやさ優先がオフなら総徒歩距離が最短の経路を選ぶ", () => {
    expect(selectBestRouteCandidate(candidates, false)?.id).toBe("short-walk");
  });

  test("主条件が同じ場合はもう一方の条件が短い経路を選ぶ", () => {
    const equalWalkingDistanceCandidates: TestRouteCandidate[] = [
      { id: "slow", totalWalkingDistance: 0.2, totalDuration: 35 },
      { id: "fast", totalWalkingDistance: 0.2, totalDuration: 20 },
    ];

    expect(
      selectBestRouteCandidate(equalWalkingDistanceCandidates, false)?.id
    ).toBe("fast");
  });

  test("候補が空ならundefinedを返す", () => {
    expect(selectBestRouteCandidate([], false)).toBeUndefined();
  });
});
