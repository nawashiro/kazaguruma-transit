import {
  buildRouteResultsUrl,
  buildTransitApiUrl,
  parseRouteSearchParams,
  type RouteSearchQuery,
} from "../route-search-query";

const query: RouteSearchQuery = {
  origin: { lat: 35.68, lng: 139.76 },
  destination: { lat: 35.7, lng: 139.78 },
  time: "2026-07-18T09:30",
  isDeparture: true,
  prioritizeSpeed: false,
};

describe("route search query", () => {
  it("検索条件を結果URLへ直列化し、同じ条件へ復元する", () => {
    const url = buildRouteResultsUrl(query);

    expect(url).toBe(
      "/routes?origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
    );
    expect(parseRouteSearchParams(new URLSearchParams(url.split("?")[1]))).toEqual({
      isValid: true,
      query,
    });
  });

  it("結果URLとAPI URLで同じ検索条件表現を再利用する", () => {
    expect(buildTransitApiUrl(query)).toBe(
      "/api/transit?type=route&origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
    );
  });

  it.each([
    ["必須値不足", "origin=35.68%2C139.76"],
    ["緯度の範囲外", "origin=91%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false"],
    ["経度の範囲外", "origin=35.68%2C181&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false"],
    ["不正な日時", "origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-02-30T09%3A30&isDeparture=true&prioritizeSpeed=false"],
    ["不正な真偽値", "origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=1&prioritizeSpeed=false"],
  ])("%sを拒否する", (_label, search) => {
    const result = parseRouteSearchParams(new URLSearchParams(search));

    expect(result.isValid).toBe(false);
    if (!result.isValid) {
      expect(result.error).toMatch(/検索条件/);
    }
  });
});
