import {
  readBoundaryFromGeocodeIndex,
  updateWalkNetwork,
} from "../update-walk-network";

const TOWN_GEOJSON = {
  boundary: [
    {
      name: "東京都千代田区試験町",
      polygons: [
        [
          [
            [139.75, 35.69],
            [139.76, 35.69],
            [139.76, 35.7],
            [139.75, 35.7],
            [139.75, 35.69],
          ],
        ],
      ],
    },
  ],
};

const OSM_ITEMS = [
  { type: "node", id: 1, lat: 35.695, lon: 139.755 },
  { type: "node", id: 2, lat: 35.6952, lon: 139.755 },
  { type: "node", id: 3, lat: 35.6954, lon: 139.755 },
  { type: "way", id: 10, refs: [1, 2, 3], tags: { highway: "footway" } },
];

function stream(items: unknown[]) {
  return (async function* () {
    yield items;
  })();
}

describe("updateWalkNetwork", () => {
  const reports: string[] = [];

  beforeEach(() => {
    reports.length = 0;
  });

  it("OSM抽出から徒歩ネットワークを組み立てて書き出す", async () => {
    let written: string | null = null;
    const result = await updateWalkNetwork({
      openOsm: async () => stream(OSM_ITEMS),
      readBoundary: async () => TOWN_GEOJSON.boundary,
      loadStops: async () => [{ name: "試験停留所", lat: 35.695, lng: 139.755 }],
      readExisting: async () => null,
      write: async (contents) => {
        written = contents;
      },
      report: (message) => reports.push(message),
    });

    expect(result.written).toBe(true);
    expect(result.counts.nodes).toBe(3);
    expect(result.counts.edges).toBe(2);
    const parsed = JSON.parse(written as unknown as string) as {
      nodes: number[][];
      edges: number[][];
    };
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges).toHaveLength(2);
    expect(reports).toContain("徒歩ネットワークを書き出しました");
  });

  it("内容が同じなら書き換えない", async () => {
    let first: string | null = null;
    await updateWalkNetwork({
      openOsm: async () => stream(OSM_ITEMS),
      readBoundary: async () => TOWN_GEOJSON.boundary,
      loadStops: async () => [],
      readExisting: async () => null,
      write: async (contents) => {
        first = contents;
      },
      report: (message) => reports.push(message),
    });
    expect(first).not.toBeNull();

    let secondWritten = false;
    const result = await updateWalkNetwork({
      openOsm: async () => stream(OSM_ITEMS),
      readBoundary: async () => TOWN_GEOJSON.boundary,
      loadStops: async () => [],
      readExisting: async () => first,
      write: async () => {
        secondWritten = true;
      },
      report: (message) => reports.push(message),
    });

    expect(result.written).toBe(false);
    expect(secondWritten).toBe(false);
    expect(reports).toContain("徒歩ネットワークに変更はありません");
  });
});

describe("readBoundaryFromGeocodeIndex", () => {
  it("地点索引のboundaryを読む", async () => {
    const { writeFile, mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const directory = await mkdtemp(path.join(tmpdir(), "walk-boundary-"));
    const target = path.join(directory, "index.json");
    await writeFile(target, JSON.stringify(TOWN_GEOJSON));

    const boundary = await readBoundaryFromGeocodeIndex(target);

    expect(boundary).toHaveLength(1);
    expect(boundary[0].name).toBe("東京都千代田区試験町");
  });

  it("boundaryがない索引を拒否する", async () => {
    const { writeFile, mkdtemp } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const directory = await mkdtemp(path.join(tmpdir(), "walk-boundary-"));
    const target = path.join(directory, "index.json");
    await writeFile(target, JSON.stringify({ version: 1 }));

    await expect(readBoundaryFromGeocodeIndex(target)).rejects.toThrow(
      "地点索引に boundary がありません",
    );
  });
});
