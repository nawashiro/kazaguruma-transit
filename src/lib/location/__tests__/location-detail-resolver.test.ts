import type { LocationEntry } from "@/lib/location/location-artifact";

export {};

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

function getResolver(state: ModuleState): PublicFunction {
  const publicName = "resolveLocationDetail";
  const modulePath = "../location-detail-resolver";

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(`${publicName} is not implemented: public module ${modulePath} exported nothing`);
  }

  const resolver = state.exports[publicName];
  if (typeof resolver !== "function") {
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} does not export ${publicName}`,
    );
  }
  return resolver as PublicFunction;
}

type LocationFixture = LocationEntry & {
    area?: string;
  };

type LocationCategoryFixture = {
  category: string;
  categoryId: string;
  locations: LocationFixture[];
};

const primaryLocation: LocationFixture = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000001",
  name: "千代田区役所",
  lat: 35.694,
  lng: 139.753,
  area: "神田",
  relatedPages: [],
  osmElement: { type: "node", id: 1 },
  wheelchair: "yes",
  osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
};

const locationWithoutOptionalDisplayFields: LocationFixture = {
  id: "urn:uuid:00000000-0000-4000-8000-000000000002",
  name: "小川町ホール",
  lat: 35.695,
  lng: 139.765,
  relatedPages: [],
  osmElement: { type: "way", id: 2 },
  wheelchair: null,
  osmEditUrl: "https://www.openstreetmap.org/edit?way=2",
};

function success(categories: LocationCategoryFixture[]) {
  return { status: "success", categories };
}

function loadError(message = "場所データを取得できませんでした") {
  return { status: "error", error: new Error(message) };
}

const factsLocation: LocationFixture = {
  ...primaryLocation,
  phone: { display: "03-3264-2111", tel: "tel:0332642111" },
  websiteUri: "https://www.city.chiyoda.lg.jp/",
  wikipediaUri: "https://ja.wikipedia.org/wiki/%E5%8D%83%E4%BB%A3%E7%94%B0",
  osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
};

describe("resolveLocationDetail", () => {
  const moduleState = loadModule("../location-detail-resolver");

  it.each([
    success([
      {
        category: "市役所・東京都の区役所",
        categoryId: "1302",
        locations: [primaryLocation],
      },
    ]),
    success([]),
  ])(
    "classifies an empty identifier as an error even when the dataset is empty: %p",
    (data) => {
      const resolve = getResolver(moduleState);

      const result = resolve("", data);

      expect(result).toMatchObject({ status: "error" });
      expect(result).not.toHaveProperty("location");
    },
  );

  it("returns one matching location and preserves its primary information", () => {
    const resolve = getResolver(moduleState);

    const result = resolve(
      "urn:uuid:00000000-0000-4000-8000-000000000002",
      success([
        {
          category: "市役所・東京都の区役所",
          categoryId: "1302",
          locations: [primaryLocation, locationWithoutOptionalDisplayFields],
        },
      ]),
    );

    expect(result).toMatchObject({
      status: "success",
      location: {
        id: "urn:uuid:00000000-0000-4000-8000-000000000002",
        name: "小川町ホール",
        lat: 35.695,
        lng: 139.765,
      },
    });
  });

  it("classifies a malformed location missing primary fields as an error", () => {
    const resolve = getResolver(moduleState);
    const malformedWireData = {
      status: "success",
      categories: [
        {
          category: "市役所・東京都の区役所",
          categoryId: "1302",
          locations: [{ id: "urn:uuid:00000000-0000-4000-8000-000000000001" }],
        },
      ],
    };

    const result = resolve(
      "urn:uuid:00000000-0000-4000-8000-000000000001",
      malformedWireData as unknown as any,
    );

    expect(result).toMatchObject({
      status: "error",
      reason: "invalid-data",
    });
    expect(result).not.toMatchObject({ status: "success" });
    expect(result).not.toHaveProperty("location");
  });

  it("classifies an invalid route identifier separately from invalid location data", () => {
    const resolve = getResolver(moduleState);

    const result = resolve("invalid-id", success([
      {
        category: "市役所・東京都の区役所",
        categoryId: "1302",
        locations: [primaryLocation],
      },
    ]));

    expect(result).toMatchObject({
      status: "error",
      reason: "invalid-request-id",
    });
    expect(result).not.toHaveProperty("location");
  });

  it("classifies an invalid identifier inside loaded data as invalid-data", () => {
    const resolve = getResolver(moduleState);
    const invalidData = success([
      {
        category: "市役所・東京都の区役所",
        categoryId: "1302",
        locations: [{ ...primaryLocation, id: "invalid-id" }],
      },
    ]);

    const result = resolve("urn:uuid:00000000-0000-4000-8000-000000000001", invalidData);

    expect(result).toMatchObject({
      status: "error",
      reason: "invalid-data",
    });
    expect(result).not.toHaveProperty("location");
  });

  it.each([
    ["null", null],
    ["unknown status", { status: "unknown", categories: [] }],
    ["non-Error transport error", { status: "error", error: "not-an-error" }],
  ] as const)("fails closed for malformed runtime result input (%s)", (_label, data) => {
    const resolve = getResolver(moduleState);
    let result: unknown = undefined;

    expect(() => {
      result = resolve("urn:uuid:00000000-0000-4000-8000-000000000001", data as unknown as any);
    }).not.toThrow();

    expect(result).toMatchObject({
      status: "error",
      reason: "invalid-data",
    });
    expect(result).not.toHaveProperty("location");
  });

  it("classifies an unknown non-empty identifier in an empty dataset as not-found", () => {
    const resolve = getResolver(moduleState);

    const result = resolve(
      "urn:uuid:00000000-0000-4000-8000-0000000000ff",
      success([
        {
          category: "市役所・東京都の区役所",
          categoryId: "1302",
          locations: [primaryLocation],
        },
      ]),
    );

    expect(result).toMatchObject({ status: "not-found" });
    expect(result).not.toHaveProperty("location");
  });

  it("classifies duplicate identifiers as an error rather than selecting the first match", () => {
    const resolve = getResolver(moduleState);

    const duplicate = { ...primaryLocation, name: "同じIDの別施設" };
    const result = resolve(
      "urn:uuid:00000000-0000-4000-8000-000000000001",
      success([
        {
          category: "市役所・東京都の区役所",
          categoryId: "1302",
          locations: [primaryLocation],
        },
        {
          category: "別カテゴリ",
          categoryId: "1512",
          locations: [duplicate],
        },
      ]),
    );

    expect(result).toMatchObject({
      status: "error",
      reason: "duplicate-id",
    });
    expect(result).not.toMatchObject({ status: "success" });
  });

  it("resolves the same location in two categories as one detail", () => {
    const resolve = getResolver(moduleState);

    const result = resolve(
      "urn:uuid:00000000-0000-4000-8000-000000000001",
      success([
        {
          category: "市役所・東京都の区役所",
          categoryId: "1302",
          locations: [primaryLocation],
        },
        {
          category: "図書館",
          categoryId: "1512",
          locations: [{ ...primaryLocation }],
        },
      ]),
    );

    expect(result).toMatchObject({
      status: "success",
      location: { id: primaryLocation.id },
    });
  });

  it("passes facts through to detail and leaves missing facts as undefined", () => {
    const resolve = getResolver(moduleState);
    const withFacts = resolve(
      factsLocation.id,
      success([
        { category: "市役所・東京都の区役所", categoryId: "1302", locations: [factsLocation] },
      ]),
    ) as any;
    expect(withFacts).toMatchObject({
      status: "success",
      location: {
        phone: { display: "03-3264-2111", tel: "tel:0332642111" },
        websiteUri: "https://www.city.chiyoda.lg.jp/",
        osmEditUrl: "https://www.openstreetmap.org/edit?node=1",
      },
    });
    const withoutFacts = resolve(
      locationWithoutOptionalDisplayFields.id,
      success([
        { category: "市役所・東京都の区役所", categoryId: "1302", locations: [locationWithoutOptionalDisplayFields] },
      ]),
    ) as any;
    expect(withoutFacts).toMatchObject({ status: "success" });
    if (withoutFacts.status === "success") {
      expect(withoutFacts.location.phone).toBeUndefined();
      expect(withoutFacts.location.websiteUri).toBeUndefined();
      expect(withoutFacts.location.wikipediaUri).toBeUndefined();
    }
  });

  it("classifies upstream transport failure as data-load-error, not not-found", () => {
    const resolve = getResolver(moduleState);

    const result = resolve("urn:uuid:00000000-0000-4000-8000-000000000001", loadError("HTTP 503"));

    expect(result).toMatchObject({ status: "data-load-error" });
    expect(result).not.toMatchObject({ status: "not-found" });
    expect(result).not.toHaveProperty("location");
  });
});
