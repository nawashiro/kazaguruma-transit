/** @jest-environment node */

import fs from "fs";
import path from "path";

jest.unmock("fs");

type GeoUtilsModule = typeof import("../geoUtils");
type GeoJSONFeature = {
  type: "Feature";
  properties: {
    name: string;
    uri: string;
  };
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
};
type FeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

const GEOJSON_CDN_URL =
  "https://cdn.jsdelivr.net/gh/nawashiro/chiyoda_city_town_geojson@latest/chiyoda_city.json";
const LOCAL_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "public",
  "geojson",
  "chiyoda_city.geojson",
);

const validFeatureCollection: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        name: "神田",
        uri: "https://example.test/areas/kanda",
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [139.7, 35.6],
            [139.8, 35.6],
            [139.8, 35.7],
            [139.7, 35.7],
            [139.7, 35.6],
          ],
        ],
      },
    },
  ],
};

let existsSyncMock: jest.SpyInstance;
let readFileSyncMock: jest.SpyInstance;
let fetchMock: jest.MockedFunction<typeof fetch>;
const originalFetch = global.fetch;

/**
 * These tests call the Node/server utility directly. The fetch stub represents
 * the server's global fetch; no browser component or browser CDN request is used.
 */

function loadGeoUtils(): GeoUtilsModule {
  let loaded: GeoUtilsModule | undefined;

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- load a fresh cache per test
    loaded = require("../geoUtils") as GeoUtilsModule;
  });

  if (!loaded) {
    throw new Error("geoUtils module did not load");
  }
  return loaded;
}

function missingSnapshotError(): NodeJS.ErrnoException {
  const error = new Error(`missing local GeoJSON snapshot: ${LOCAL_SNAPSHOT_PATH}`) as NodeJS.ErrnoException;
  error.code = "ENOENT";
  return error;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(payload),
  } as unknown as Response;
}

beforeEach(() => {
  existsSyncMock = jest.spyOn(fs, "existsSync").mockReturnValue(false);
  readFileSyncMock = jest
    .spyOn(fs, "readFileSync")
    .mockImplementation(() => {
      throw missingSnapshotError();
    });
  fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  global.fetch = fetchMock;
});

afterEach(() => {
  existsSyncMock.mockRestore();
  readFileSyncMock.mockRestore();
  global.fetch = originalFetch;
});

describe("server-side geoUtils GeoJSON boundary", () => {
  it("falls back to the CDN when the local snapshot is absent and returns a valid FeatureCollection", async () => {
    const { loadGeoJSON } = loadGeoUtils();
    fetchMock.mockResolvedValueOnce(jsonResponse(validFeatureCollection));

    const result = await loadGeoJSON();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(GEOJSON_CDN_URL);
    expect(result).toEqual(validFeatureCollection);
    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toMatchObject({
      type: "Feature",
      properties: {
        name: "神田",
        uri: "https://example.test/areas/kanda",
      },
      geometry: {
        type: "Polygon",
      },
    });
  });

  it("caches a successful server-side CDN fallback without a second CDN request", async () => {
    const { loadGeoJSON } = loadGeoUtils();
    fetchMock.mockResolvedValueOnce(jsonResponse(validFeatureCollection));

    const firstResult = await loadGeoJSON();
    const secondResult = await loadGeoJSON();

    expect(secondResult).toBe(firstResult);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(GEOJSON_CDN_URL);
  });

  it("surfaces a CDN HTTP failure as a server error instead of returning an empty collection", async () => {
    const { loadGeoJSON } = loadGeoUtils();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 503));

    await expect(loadGeoJSON()).rejects.toThrow(/HTTP 503/);
  });

  it("surfaces invalid CDN JSON as a server error instead of returning an empty collection", async () => {
    const { loadGeoJSON } = loadGeoUtils();
    const jsonParseError = new Error("invalid GeoJSON JSON");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(jsonParseError),
    } as unknown as Response);

    await expect(loadGeoJSON()).rejects.toThrow("invalid GeoJSON JSON");
  });
});
