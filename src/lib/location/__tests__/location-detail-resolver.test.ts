import type {
  KeyLocation,
  KeyLocationsDataResult,
} from "@/utils/addressLoader";

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

// The wire fixture intentionally omits optional display metadata while keeping primary fields explicit.
type KeyLocationFixture =
  Pick<KeyLocation, "id" | "name" | "lat" | "lng" | "nodeCopyright" | "licence" | "licenceUri"> &
  Partial<
    Pick<
      KeyLocation,
      "description" | "descriptionCopyright" | "imageUri" | "imageCopylight" | "uri" | "nodeSourceId"
    >
  > & {
    area?: string;
  };

type KeyLocationCategoryFixture = {
  category: string;
  "category:en": string;
  locations: KeyLocationFixture[];
};

const primaryLocation: KeyLocationFixture = {
  id: "kanda-library",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  area: "神田",
  description: "地域の図書館です",
  imageUri: "https://example.test/kanda-library.jpg",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const locationWithoutOptionalDisplayFields: KeyLocationFixture = {
  id: "ogawamachi-hall",
  name: "小川町ホール",
  lat: 35.695,
  lng: 139.765,
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

function success(categories: KeyLocationCategoryFixture[]) {
  return { status: "success", categories };
}

function loadError(message = "場所データを取得できませんでした") {
  return { status: "error", error: new Error(message) };
}

describe("resolveLocationDetail", () => {
  const moduleState = loadModule("../location-detail-resolver");

  it.each([
    success([
      {
        category: "公共施設",
        "category:en": "public-facilities",
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
      "ogawamachi-hall",
      success([
        {
          category: "公共施設",
          "category:en": "public-facilities",
          locations: [primaryLocation, locationWithoutOptionalDisplayFields],
        },
      ]),
    );

    expect(result).toMatchObject({
      status: "success",
      location: {
        id: "ogawamachi-hall",
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
          category: "公共施設",
          "category:en": "public-facilities",
          locations: [{ id: "x" }],
        },
      ],
    };

    const result = resolve(
      "x",
      malformedWireData as unknown as KeyLocationsDataResult,
    );

    expect(result).toMatchObject({ status: "error" });
    expect(result).not.toMatchObject({ status: "success" });
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
      result = resolve("kanda-library", data as unknown as KeyLocationsDataResult);
    }).not.toThrow();

    expect(result).toMatchObject({ status: "error" });
    expect(result).not.toHaveProperty("location");
  });

  it("classifies an unknown non-empty identifier in an empty dataset as not-found", () => {
    const resolve = getResolver(moduleState);

    const result = resolve("unknown-location", success([]));

    expect(result).toMatchObject({ status: "not-found" });
    expect(result).not.toHaveProperty("location");
  });

  it("classifies duplicate identifiers as an error rather than selecting the first match", () => {
    const resolve = getResolver(moduleState);

    const duplicate = { ...primaryLocation, name: "同じIDの別施設" };
    const result = resolve(
      "kanda-library",
      success([
        {
          category: "公共施設",
          "category:en": "public-facilities",
          locations: [primaryLocation],
        },
        {
          category: "別カテゴリ",
          "category:en": "another-category",
          locations: [duplicate],
        },
      ]),
    );

    expect(result).toMatchObject({ status: "error" });
    expect(result).not.toMatchObject({ status: "success" });
  });

  it("classifies upstream transport failure as data-load-error, not not-found", () => {
    const resolve = getResolver(moduleState);

    const result = resolve("kanda-library", loadError("HTTP 503"));

    expect(result).toMatchObject({ status: "data-load-error" });
    expect(result).not.toMatchObject({ status: "not-found" });
    expect(result).not.toHaveProperty("location");
  });
});
