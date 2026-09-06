import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  emptyKeyLocationCategory,
  malformedMainFacilities,
  malformedKeyLocations,
  malformedTownGeoJson,
  townGeoJsonWithHole,
  validKeyLocations,
  validKeyLocationWithoutDisplayMetadata,
  validMainFacilities,
} from "../fixtures/location-build-data";

type PublicFunction = (...args: unknown[]) => unknown;
type PublicModule = Record<string, unknown>;

let buildDataModule: PublicModule | undefined;
let moduleLoadError: unknown;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- this isolated assertion preserves the honest missing-module RED state
  const loaded: unknown = require("../location-build-data");
  if (typeof loaded !== "object" || loaded === null) {
    moduleLoadError = new Error("location-build-data must export an object");
  } else {
    buildDataModule = loaded as PublicModule;
  }
} catch (error) {
  moduleLoadError = error;
}

function getPublicFunction(name: string): PublicFunction {
  const candidate = buildDataModule?.[name];
  if (typeof candidate !== "function") {
    throw new Error(`location-build-data must export ${name}`);
  }
  return candidate as PublicFunction;
}

function buildLocationData(input: unknown) {
  return getPublicFunction("buildLocationData")(input);
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    locationsDataVersion: "2.1.1",
    generatedAt: "2026-09-05T00:00:00.000Z",
    mainFacilities: validMainFacilities,
    keyLocations: validKeyLocations,
    townGeoJson: townGeoJsonWithHole,
    ...overrides,
  };
}

function categoryById(snapshot: unknown, id: string): unknown {
  const categories = (snapshot as { categories?: unknown }).categories;
  if (!Array.isArray(categories)) {
    return undefined;
  }

  return categories.find(
    (category) =>
      typeof category === "object" &&
      category !== null &&
      (category as { id?: unknown }).id === id,
  );
}

const describeImplementedModule = buildDataModule === undefined ? describe.skip : describe;

describe("location-build-data", () => {
  it("requires the location build-data module before behavior can run", () => {
    expect(moduleLoadError).toBeUndefined();
  });

  describeImplementedModule("public build-data contract", () => {
    it("exports synchronous build and asynchronous loading and artifact generation functions", () => {
      expect(buildDataModule).toEqual(
        expect.objectContaining({
          buildLocationData: expect.any(Function),
          loadAndBuildLocationData: expect.any(Function),
          generateLocationDataArtifact: expect.any(Function),
        }),
      );
    });

    it("builds one snapshot from simple main facilities and detailed key locations", () => {
      const snapshot = buildLocationData(validInput());

      expect(snapshot).toMatchObject({
        locationsDataVersion: "2.1.1",
        generatedAt: "2026-09-05T00:00:00.000Z",
        suggestionCategories: [
          {
            categoryName: "よく利用される施設",
            locations: [{ name: "神田図書館", lat: 35.695, lng: 139.765 }],
          },
        ],
      });
      expect(categoryById(snapshot, "public facilities")).toMatchObject({
        id: "public facilities",
        name: "公共施設",
        locations: [
          {
            id: "kanda-library",
            name: "神田図書館",
            lat: 35.692,
            lng: 139.762,
            areaName: "神田",
            description: "地域の図書館です",
            imageUri: "https://example.test/kanda-library.jpg",
            imageCopyright: "千代田区写真室",
            uri: "https://example.test/kanda-library",
            descriptionCopyright: "千代田区文化振興課",
            nodeCopyright: "千代田区",
            licence: "CC BY 4.0",
            licenceUri: "https://creativecommons.org/licenses/by/4.0/",
          },
        ],
      });
    });

    it("keeps a valid detailed facility without optional display metadata", () => {
      const snapshot = buildLocationData(
        validInput({ keyLocations: [validKeyLocationWithoutDisplayMetadata] }),
      );

      expect(categoryById(snapshot, "no-display-metadata")).toMatchObject({
        id: "no-display-metadata",
        name: "表示情報なし",
        locations: [
          {
            id: "metadata-optional-facility",
            name: "表示情報なし施設",
            lat: 35.693,
            lng: 139.763,
            nodeCopyright: "千代田区",
            licence: "CC BY 4.0",
            licenceUri: "https://creativecommons.org/licenses/by/4.0/",
          },
        ],
      });
    });

    it("keeps a valid empty detailed category in the snapshot", () => {
      const snapshot = buildLocationData(
        validInput({ keyLocations: [...validKeyLocations, emptyKeyLocationCategory] }),
      );

      expect(categoryById(snapshot, "empty category")).toEqual({
        id: "empty category",
        name: "空カテゴリ",
        locations: [],
      });
    });

    it("rejects duplicate facility IDs across detailed categories", () => {
      expect(() =>
        buildLocationData(
          validInput({
            keyLocations: [
              ...validKeyLocations,
              {
                category: "重複カテゴリ",
                "category:en": "duplicate category",
                locations: [{ ...validKeyLocations[0].locations[0], name: "重複施設" }],
              },
            ],
          }),
        ),
      ).toThrow();
    });

    it.each([
      ["empty", ""],
      ["leading whitespace", " public facilities"],
      ["trailing whitespace", "public facilities "],
      ["ASCII control character", "public\u001ffacilities"],
      ["slash", "public/facilities"],
      ["question mark", "public?facilities"],
      ["fragment marker", "public#facilities"],
      ["dot", "."],
      ["dot dot", ".."],
      ["reserved detail route", "location-detail"],
    ])("rejects a category ID with %s", (_label, categoryId) => {
      expect(() =>
        buildLocationData(
          validInput({
            keyLocations: [
              {
                ...validKeyLocations[0],
                "category:en": categoryId,
              },
            ],
          }),
        ),
      ).toThrow();
    });

    it("rejects duplicate category IDs", () => {
      expect(() =>
        buildLocationData(
          validInput({
            keyLocations: [
              ...validKeyLocations,
              {
                category: "重複カテゴリ",
                "category:en": "public facilities",
                locations: [],
              },
            ],
          }),
        ),
      ).toThrow();
    });

    it("preserves an internal space in a valid category ID without slug normalization", () => {
      expect(categoryById(buildLocationData(validInput()), "public facilities")).toHaveProperty(
        "id",
        "public facilities",
      );
    });

    it.each([
      ["latitude below -90", { lat: -90.001 }],
      ["latitude above 90", { lat: 90.001 }],
      ["longitude below -180", { lng: -180.001 }],
      ["longitude above 180", { lng: 180.001 }],
      ["NaN latitude", { lat: Number.NaN }],
      ["infinite longitude", { lng: Number.POSITIVE_INFINITY }],
    ])("rejects a detailed facility with %s", (_label, coordinate) => {
      expect(() =>
        buildLocationData(
          validInput({
            keyLocations: [
              {
                ...validKeyLocations[0],
                locations: [{ ...validKeyLocations[0].locations[0], ...coordinate }],
              },
            ],
          }),
        ),
      ).toThrow();
    });

    it.each([
      ["empty", ""],
      ["leading whitespace", " kanda-library"],
      ["trailing whitespace", "kanda-library "],
      ["control character", "kanda\u001flibrary"],
      ["slash", "kanda/library"],
      ["question mark", "kanda?library"],
      ["fragment marker", "kanda#library"],
    ])("rejects a detailed facility ID with %s", (_label, id) => {
      expect(() =>
        buildLocationData(
          validInput({
            keyLocations: [
              {
                ...validKeyLocations[0],
                locations: [{ ...validKeyLocations[0].locations[0], id }],
              },
            ],
          }),
        ),
      ).toThrow();
    });

    it.each([
      ["NaN latitude", { lat: Number.NaN }],
      ["infinite longitude", { lng: Number.POSITIVE_INFINITY }],
      ["latitude above 90", { lat: 90.001 }],
    ])("rejects a main facility candidate with %s", (_label, coordinate) => {
      expect(() =>
        buildLocationData(
          validInput({
            mainFacilities: [
              {
                ...validMainFacilities[0],
                locations: [{ ...validMainFacilities[0].locations[0], ...coordinate }],
              },
            ],
          }),
        ),
      ).toThrow();
    });

    it.each([
      ["empty locations data version", { locationsDataVersion: "" }],
      ["invalid generated time", { generatedAt: "not-a-time" }],
      ["non-ISO generated time", { generatedAt: "2026/09/05 00:00:00" }],
    ])("rejects a snapshot with %s", (_label, override) => {
      expect(() => buildLocationData(validInput(override))).toThrow();
    });

    it("treats a Polygon hole as outside and assigns 地域不明", () => {
      const snapshot = buildLocationData(
        validInput({
          keyLocations: [
            {
              ...validKeyLocations[0],
              locations: [{ ...validKeyLocations[0].locations[0], lat: 35.695, lng: 139.765 }],
            },
          ],
        }),
      );

      expect(categoryById(snapshot, "public facilities")).toMatchObject({
        locations: [{ areaName: "地域不明" }],
      });
    });

    it("assigns 地域不明 when no GeoJSON town contains the detailed facility", () => {
      const snapshot = buildLocationData(
        validInput({
          keyLocations: [
            {
              ...validKeyLocations[0],
              locations: [{ ...validKeyLocations[0].locations[0], lat: 35.71, lng: 139.78 }],
            },
          ],
        }),
      );

      expect(categoryById(snapshot, "public facilities")).toMatchObject({
        locations: [{ areaName: "地域不明" }],
      });
    });

    it("returns the same snapshot after all three source loaders succeed", async () => {
      const loadAndBuildLocationData = getPublicFunction("loadAndBuildLocationData");
      const snapshot = await loadAndBuildLocationData({
        locationsDataVersion: "2.1.1",
        generatedAt: "2026-09-05T00:00:00.000Z",
        loadMainFacilities: async () => validMainFacilities,
        loadKeyLocations: async () => validKeyLocations,
        loadTownGeoJson: async () => townGeoJsonWithHole,
      });

      expect(snapshot).toEqual(buildLocationData(validInput()));
    });

    it("rejects rather than returning an empty snapshot when a source loader fails", async () => {
      const loadAndBuildLocationData = getPublicFunction("loadAndBuildLocationData");

      await expect(
        loadAndBuildLocationData({
          locationsDataVersion: "2.1.1",
          generatedAt: "2026-09-05T00:00:00.000Z",
          loadMainFacilities: async () => validMainFacilities,
          loadKeyLocations: async () => {
            throw new Error("source unavailable");
          },
          loadTownGeoJson: async () => townGeoJsonWithHole,
        }),
      ).rejects.toBeDefined();
    });

    it("rejects a fetched detailed payload with an invalid facility shape", async () => {
      const loadAndBuildLocationData = getPublicFunction("loadAndBuildLocationData");

      await expect(
        loadAndBuildLocationData({
          locationsDataVersion: "2.1.1",
          generatedAt: "2026-09-05T00:00:00.000Z",
          loadMainFacilities: async () => validMainFacilities,
          loadKeyLocations: async () => malformedKeyLocations,
          loadTownGeoJson: async () => townGeoJsonWithHole,
        }),
      ).rejects.toBeDefined();
    });

    it("rejects a fetched main facilities payload with an invalid candidate shape", async () => {
      const loadAndBuildLocationData = getPublicFunction("loadAndBuildLocationData");

      await expect(
        loadAndBuildLocationData({
          locationsDataVersion: "2.1.1",
          generatedAt: "2026-09-05T00:00:00.000Z",
          loadMainFacilities: async () => malformedMainFacilities,
          loadKeyLocations: async () => validKeyLocations,
          loadTownGeoJson: async () => townGeoJsonWithHole,
        }),
      ).rejects.toBeDefined();
    });

    it("rejects a fetched GeoJSON payload with an invalid polygon shape", async () => {
      const loadAndBuildLocationData = getPublicFunction("loadAndBuildLocationData");

      await expect(
        loadAndBuildLocationData({
          locationsDataVersion: "2.1.1",
          generatedAt: "2026-09-05T00:00:00.000Z",
          loadMainFacilities: async () => validMainFacilities,
          loadKeyLocations: async () => validKeyLocations,
          loadTownGeoJson: async () => malformedTownGeoJson,
        }),
      ).rejects.toBeDefined();
    });

    it("retains the existing artifact when a source loader fails", async () => {
      const generateLocationDataArtifact = getPublicFunction("generateLocationDataArtifact");
      const directory = await mkdtemp(join(tmpdir(), "location-build-data-"));
      const outputPath = join(directory, "location-data.json");
      await writeFile(outputPath, "previous snapshot", "utf8");

      try {
        await expect(
          generateLocationDataArtifact({
            outputPath,
            locationsDataVersion: "2.1.1",
            generatedAt: "2026-09-05T00:00:00.000Z",
            loadMainFacilities: async () => validMainFacilities,
            loadKeyLocations: async () => {
              throw new Error("source unavailable");
            },
            loadTownGeoJson: async () => townGeoJsonWithHole,
          }),
        ).rejects.toBeDefined();
        await expect(readFile(outputPath, "utf8")).resolves.toBe("previous snapshot");
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

    it("fully replaces an existing artifact with a valid JSON snapshot after all loaders succeed", async () => {
      const generateLocationDataArtifact = getPublicFunction("generateLocationDataArtifact");
      const directory = await mkdtemp(join(tmpdir(), "location-build-data-"));
      const outputPath = join(directory, "location-data.json");
      await writeFile(outputPath, '{"stale":true}', "utf8");

      try {
        const snapshot = await generateLocationDataArtifact({
          outputPath,
          locationsDataVersion: "2.1.1",
          generatedAt: "2026-09-05T00:00:00.000Z",
          loadMainFacilities: async () => validMainFacilities,
          loadKeyLocations: async () => validKeyLocations,
          loadTownGeoJson: async () => townGeoJsonWithHole,
        });
        const artifact = JSON.parse(await readFile(outputPath, "utf8")) as unknown;

        expect(artifact).toEqual(snapshot);
        expect(artifact).toEqual(buildLocationData(validInput()));
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  });
});
