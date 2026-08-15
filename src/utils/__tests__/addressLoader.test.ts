import type { KeyLocation, KeyLocationCategory } from "../addressLoader";

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

function getLoader(state: ModuleState): PublicFunction {
  const publicName = "loadKeyLocationsDataResult";
  const modulePath = "../addressLoader";

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(`${publicName} is not implemented: public module ${modulePath} exported nothing`);
  }

  const loader = state.exports[publicName];
  if (typeof loader !== "function") {
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} does not export ${publicName}`,
    );
  }
  return loader as PublicFunction;
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

type InvalidImageCopyrightLocation = KeyLocationFixture & {
  imageCopyright: number;
};

type KeyLocationCategoryFixture = Omit<KeyLocationCategory, "locations"> & {
  locations: KeyLocationFixture[];
};

const completeLocation: KeyLocationFixture = {
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

// This public type fixture omits display metadata that should be optional.
const minimalLocation: KeyLocation = {
  id: "ogawamachi-hall",
  name: "小川町ホール",
  lat: 35.695,
  lng: 139.765,
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const successfulCategories: KeyLocationCategoryFixture[] = [
  {
    category: "公共施設",
    "category:en": "public-facilities",
    locations: [completeLocation, minimalLocation],
  },
];

const malformedCategories = [
  {
    category: "公共施設",
    "category:en": "public-facilities",
    locations: [{ id: "x" }],
  },
];

function successfulResponse(categories: KeyLocationCategoryFixture[]) {
  return {
    status: "success",
    categories,
  };
}

function mockJsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

describe("loadKeyLocationsDataResult", () => {
  const moduleState = loadModule("../addressLoader");
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns success data and preserves primary fields when optional fields are absent", async () => {
    const load = getLoader(moduleState);

    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(successfulCategories));

    const result = await load();

    expect(result).toMatchObject(successfulResponse(successfulCategories));
    expect(result).toHaveProperty("categories[0].locations[0].id", "kanda-library");
    expect(result).toHaveProperty("categories[0].locations[1].id", "ogawamachi-hall");
    expect(result).toHaveProperty("categories[0].locations[1].name", "小川町ホール");
    expect(result).toHaveProperty("categories[0].locations[1].lat", 35.695);
    expect(result).toHaveProperty("categories[0].locations[1].lng", 139.765);
  });

  it("treats an empty but successfully decoded dataset as success data", async () => {
    const load = getLoader(moduleState);

    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse([]));

    await expect(load()).resolves.toEqual(successfulResponse([]));
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
    ["path separator", "invalid/location"],
  ] as const)(
    "returns an error for a successfully decoded location with an invalid %s ID",
    async (_label, id) => {
      const load = getLoader(moduleState);
      const invalidIdLocation: KeyLocationFixture = { ...completeLocation, id };

      global.fetch = jest.fn().mockResolvedValue(
        mockJsonResponse([
          {
            category: "公共施設",
            "category:en": "public-facilities",
            locations: [invalidIdLocation],
          },
        ]),
      );

      const result = await load();

      expect(result).toMatchObject({ status: "error" });
      expect(result).not.toHaveProperty("categories");
    },
  );

  it("returns an error for a decoded category containing a malformed location shape", async () => {
    const load = getLoader(moduleState);

    global.fetch = jest.fn().mockResolvedValue(mockJsonResponse(malformedCategories));

    const result = await load();

    expect(result).toMatchObject({ status: "error" });
    expect(result).not.toHaveProperty("categories");
  });

  it("returns an error when the CDN imageCopyright field has an invalid runtime type", async () => {
    const load = getLoader(moduleState);
    const invalidImageCopyrightLocation: InvalidImageCopyrightLocation = {
      ...completeLocation,
      imageCopyright: 42,
    };
    const invalidImageCopyrightCategories: KeyLocationCategoryFixture[] = [
      {
        category: "公共施設",
        "category:en": "public-facilities",
        locations: [invalidImageCopyrightLocation],
      },
    ];

    global.fetch = jest.fn().mockResolvedValue(
      mockJsonResponse(invalidImageCopyrightCategories),
    );

    const result = await load();

    expect(result).toMatchObject({ status: "error" });
    expect(result).not.toHaveProperty("categories");
  });

  it("preserves an HTTP failure as a data-load error instead of an empty success", async () => {
    const load = getLoader(moduleState);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: "service unavailable" }),
    });

    const result = await load();

    expect(result).toMatchObject({ status: "error" });
    expect(result).not.toHaveProperty("categories");
  });

  it("preserves a JSON decoding failure as a data-load error", async () => {
    const load = getLoader(moduleState);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("invalid JSON");
      },
    });

    const result = await load();

    expect(result).toMatchObject({ status: "error" });
    expect(result).not.toHaveProperty("categories");
  });

  it("preserves a fetch failure as a data-load error", async () => {
    const load = getLoader(moduleState);

    global.fetch = jest.fn().mockRejectedValue(new Error("network unavailable"));

    const result = await load();

    expect(result).toMatchObject({ status: "error" });
    expect(result).not.toHaveProperty("categories");
  });
});
