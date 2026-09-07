export {};

type Coordinates = {
  lat: number;
  lng: number;
};

type ParsedOrigin =
  | { originState: "absent" }
  | { originState: "valid"; origin: Coordinates }
  | { originState: "invalid" };

type PublicFunction = (...args: unknown[]) => unknown;
type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

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

function getPublicFunction(
  state: ModuleState,
  publicName: string,
): PublicFunction {
  const modulePath = "../location-origin-query";

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(`${publicName} is not implemented: public module ${modulePath} exported nothing`);
  }

  const operation = state.exports[publicName];
  if (typeof operation !== "function") {
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} does not export ${publicName}`,
    );
  }
  return operation as PublicFunction;
}

const moduleState = loadModule("../location-origin-query");
const BASE_URL = "https://kazaguruma.invalid";

function parseOrigin(value: string | null | undefined): ParsedOrigin {
  const parseLocationOrigin = getPublicFunction(moduleState, "parseLocationOrigin");
  return parseLocationOrigin(value) as ParsedOrigin;
}

describe("location origin query", () => {
  it("URL queryのoriginを緯度・経度の順で解釈する", () => {
    const currentUrl = new URL(
      "/locations/public-facilities?origin=35.681236%2C139.767125",
      BASE_URL,
    );

    const result = parseOrigin(currentUrl.searchParams.get("origin"));

    expect(result).toMatchObject({
      originState: "valid",
      origin: { lat: 35.681236, lng: 139.767125 },
    });
  });

  it("originを緯度,経度へ直列化し、同じ座標へ復元できる", () => {
    const serializeLocationOrigin = getPublicFunction(
      moduleState,
      "serializeLocationOrigin",
    );
    const origin = { lat: 35.681236, lng: 139.767125 };
    const serialized = serializeLocationOrigin(origin);

    expect(serialized).toBe("35.681236,139.767125");
    expect(parseOrigin(serialized as string)).toMatchObject({
      originState: "valid",
      origin,
    });
    expect(new URLSearchParams({ origin: serialized as string }).toString()).toBe(
      "origin=35.681236%2C139.767125",
    );
  });

  it("千代田区外でも有限な緯度・経度を有効なoriginとして受け入れる", () => {
    const result = parseOrigin("51.5074,-0.1278");

    expect(result).toMatchObject({
      originState: "valid",
      origin: { lat: 51.5074, lng: -0.1278 },
    });
  });

  it.each([
    ["緯度・経度の区切りがない", "35.681236"],
    ["緯度がNaN", "NaN,139.767125"],
    ["経度がNaN", "35.681236,NaN"],
    ["数値でない文字列", "35.681236,not-a-number"],
    ["無限大", "Infinity,139.767125"],
    ["空のorigin値", ""],
  ] as const)("%sをinvalidとして扱う", (_label, rawOrigin) => {
    const result = parseOrigin(rawOrigin);

    expect(result).toMatchObject({ originState: "invalid" });
    expect(result).not.toHaveProperty("origin");
  });

  it.each([undefined, null])(
    "originがクエリにない場合はabsentとして扱う: %p",
    (rawOrigin) => {
      const result = parseOrigin(rawOrigin);

      expect(result).toMatchObject({ originState: "absent" });
      expect(result).not.toHaveProperty("origin");
    },
  );

});
