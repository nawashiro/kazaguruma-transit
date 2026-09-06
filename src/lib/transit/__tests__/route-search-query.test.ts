import {
  buildRouteResultsUrl,
  buildTransitApiUrl,
  parseRouteSearchParams,
  type RouteSearchQuery,
} from "../route-search-query";

type PublicModule = Record<string, unknown>;
type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};
type RouteInputField = keyof RouteSearchQuery;
type ParsedRouteInputSearchParams = {
  status: "valid" | "invalid";
  values: Partial<RouteSearchQuery>;
  errors: Partial<Record<RouteInputField, string>>;
};
type RouteInputParser = (
  searchParams: URLSearchParams,
) => ParsedRouteInputSearchParams;

function loadModule(modulePath: string): ModuleState {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    const loaded: unknown = require(modulePath);
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error(`Expected ${modulePath} to export an object`),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function getRouteInputParser(state: ModuleState): RouteInputParser {
  const publicName = "parseRouteInputSearchParams";
  const modulePath = "../route-search-query";

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(`${publicName} is not implemented: public module ${modulePath} exported nothing`);
  }

  const parser: unknown = state.exports[publicName];
  if (typeof parser !== "function") {
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} does not export ${publicName}`,
    );
  }
  return parser as RouteInputParser;
}

const routeInputModuleState = loadModule("../route-search-query");
const routeInputParserAvailable =
  routeInputModuleState.error === null &&
  routeInputModuleState.exports !== null &&
  typeof routeInputModuleState.exports.parseRouteInputSearchParams === "function";

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

if (!routeInputParserAvailable) {
  describe("部分入力URL parser の公開境界", () => {
    it("未実装の parseRouteInputSearchParams を明示的な RED として報告する", () => {
      // This assertion intentionally fails until the public export exists.
      const parseRouteInputSearchParams = getRouteInputParser(routeInputModuleState);

      expect(parseRouteInputSearchParams).toEqual(expect.any(Function));
    });
  });
} else {
  const parseRouteInputSearchParams = getRouteInputParser(routeInputModuleState);

  describe("partial route input URL parser", () => {
    it("目的地だけのURLを有効な部分入力として受理し、未指定と不正を区別する", () => {
      const result = parseRouteInputSearchParams(
        new URLSearchParams("destination=35.7%2C139.78"),
      );

      expect(result).toEqual({
        status: "valid",
        values: { destination: { lat: 35.7, lng: 139.78 } },
        errors: {},
      });
      expect(result.values).not.toHaveProperty("origin");
      expect(result.errors).not.toHaveProperty("origin");
    });

    it("有効な5項目を結果URLと同じ形で受理する", () => {
      const result = parseRouteInputSearchParams(
        new URLSearchParams(
          "origin=35.68%2C139.76&destination=35.7%2C139.78&time=2026-07-18T09%3A30&isDeparture=true&prioritizeSpeed=false",
        ),
      );

      expect(result).toEqual({
        status: "valid",
        values: query,
        errors: {},
      });
    });

    it("有効な値を保持しながら、指定済みの不正項目だけを公開する", () => {
      const result = parseRouteInputSearchParams(
        new URLSearchParams(
          "origin=35.68%2C139.76&destination=91%2C139.78&time=2026-07-18T09%3A30&isDeparture=1&prioritizeSpeed=false",
        ),
      );

      expect(result.status).toBe("invalid");
      expect(result.values).toEqual({
        origin: { lat: 35.68, lng: 139.76 },
        time: "2026-07-18T09:30",
        prioritizeSpeed: false,
      });
      expect(result.errors).toEqual({
        destination: expect.any(String),
        isDeparture: expect.any(String),
      });
      expect(result.errors).not.toHaveProperty("origin");
      expect(result.errors).not.toHaveProperty("time");
      expect(result.errors).not.toHaveProperty("prioritizeSpeed");
    });

    it.each([
      ["緯度の範囲外", "destination=91%2C139.78", "destination"],
      ["経度の範囲外", "destination=35.7%2C181", "destination"],
      ["緯度が非有限", "destination=Infinity%2C139.78", "destination"],
      ["経度が非有限", "destination=35.7%2CNaN", "destination"],
      ["存在しない日付", "time=2026-02-30T09%3A30", "time"],
      ["ISO形式でない日時", "time=2026%2F07%2F18%2009%3A30", "time"],
      ["不正な出発到着指定", "isDeparture=1", "isDeparture"],
      ["不正な優先条件", "prioritizeSpeed=yes", "prioritizeSpeed"],
    ])("%sを項目別エラーとして拒否する", (_label, search, field) => {
      const result = parseRouteInputSearchParams(new URLSearchParams(search));

      expect(result.status).toBe("invalid");
      expect(result.values).toEqual({});
      expect(result.errors).toEqual({ [field]: expect.any(String) });
    });

    it("重複値では先頭の有効な値を採用する", () => {
      const searchParams = new URLSearchParams();
      searchParams.append("destination", "not-a-coordinate");
      searchParams.append("destination", "35.7,139.78");
      searchParams.append("destination", "35.8,139.79");

      const result = parseRouteInputSearchParams(searchParams);

      expect(result).toEqual({
        status: "valid",
        values: { destination: { lat: 35.7, lng: 139.78 } },
        errors: {},
      });
    });

    it("旧JSON形式のdestinationを座標入力として受理しない", () => {
      const legacyDestination = JSON.stringify({
        lat: 35.7,
        lng: 139.78,
        address: "旧形式の目的地",
      });
      const result = parseRouteInputSearchParams(
        new URLSearchParams([ ["destination", legacyDestination] ]),
      );

      expect(result.status).toBe("invalid");
      expect(result.values).toEqual({});
      expect(result.errors).toEqual({ destination: expect.any(String) });
    });
  });
}
