import {
  buildWalkNetworkArtifact,
  walkNetworkDigest,
  writeWalkNetworkIfChanged,
  WALK_NETWORK_SOURCE,
} from "../lib/walk-network-build";

const CONTENTS = {
  nodes: [
    { id: 20, lat: 35.6951, lng: 139.7551 },
    { id: 10, lat: 35.695, lng: 139.755 },
  ],
  edges: [{ a: 20, b: 10 }],
};

describe("buildWalkNetworkArtifact", () => {
  it("ノードをIDの昇順に並べ、座標を10^6倍した整数にする", () => {
    const artifact = buildWalkNetworkArtifact(CONTENTS);

    expect(artifact.version).toBe(1);
    expect(artifact.nodes).toEqual([
      [10, 35695000, 139755000],
      [20, 35695100, 139755100],
    ]);
    expect(artifact.edges).toEqual([[10, 20]]);
  });

  it("エッジの両端を小さい順に直す", () => {
    const artifact = buildWalkNetworkArtifact({
      nodes: CONTENTS.nodes,
      edges: [{ a: 20, b: 10 }],
    });

    expect(artifact.edges).toEqual([[10, 20]]);
  });

  it("同じ入力からは同じartifactになる", () => {
    const first = buildWalkNetworkArtifact(CONTENTS);
    const second = buildWalkNetworkArtifact({
      nodes: [...CONTENTS.nodes].reverse(),
      edges: [...CONTENTS.edges].reverse(),
    });

    expect(walkNetworkDigest(second)).toBe(walkNetworkDigest(first));
  });
});

describe("writeWalkNetworkIfChanged", () => {
  it("既存の内容が同じなら書き換えない", async () => {
    const reports: string[] = [];
    let written = false;

    const changed = await writeWalkNetworkIfChanged({
      artifact: buildWalkNetworkArtifact(CONTENTS),
      readExisting: async () => {
        const { serializeWalkNetwork } = await import(
          "../../src/lib/transit/walk-network"
        );
        return serializeWalkNetwork(buildWalkNetworkArtifact(CONTENTS));
      },
      write: async () => {
        written = true;
      },
      report: (message) => reports.push(message),
    });

    expect(changed).toBe(false);
    expect(written).toBe(false);
    expect(reports).toContain("徒歩ネットワークに変更はありません");
  });

  it("既存の内容が違えば書き換える", async () => {
    const reports: string[] = [];
    let written: string | null = null;

    const changed = await writeWalkNetworkIfChanged({
      artifact: buildWalkNetworkArtifact(CONTENTS),
      readExisting: async () => "{\"version\":1,\"nodes\":[],\"edges\":[]}\n",
      write: async (contents) => {
        written = contents;
      },
      report: (message) => reports.push(message),
    });

    expect(changed).toBe(true);
    expect(written).not.toBeNull();
    expect(reports).toContain("徒歩ネットワークを書き出しました");
  });

  it("既存のファイルがないときは書き換える", async () => {
    let written = false;

    const changed = await writeWalkNetworkIfChanged({
      artifact: buildWalkNetworkArtifact(CONTENTS),
      readExisting: async () => null,
      write: async () => {
        written = true;
      },
      report: () => undefined,
    });

    expect(changed).toBe(true);
    expect(written).toBe(true);
  });
});

describe("WALK_NETWORK_SOURCE", () => {
  it("OSMの出典とライセンスを持つ", () => {
    expect(WALK_NETWORK_SOURCE.license).toBe("ODbL-1.0");
    expect(WALK_NETWORK_SOURCE.extractUri).toContain("JP-13-latest.osm.pbf");
  });
});
