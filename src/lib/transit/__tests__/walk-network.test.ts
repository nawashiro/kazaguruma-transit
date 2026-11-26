import {
  buildWalkGraph,
  getWalkNetwork,
  haversineKm,
  loadWalkNetwork,
  parseWalkNetwork,
  resetWalkNetworkCache,
  searchFrom,
  serializeWalkNetwork,
  snapToNetwork,
  walkDistanceKm,
  walkRoute,
  WALK_NETWORK_VERSION,
  type WalkNetworkArtifact,
} from "../walk-network";

const KM_PER_LAT_DEGREE = 111.195;
const KM_PER_LNG_DEGREE = 111.195 * Math.cos((35.695 * Math.PI) / 180);

/** artifactは10^6倍した整数で座標を持つため、テストの点も同じ格子に載せる。 */
function at(northKm: number, eastKm = 0) {
  return {
    lat: Math.round((35.695 + northKm / KM_PER_LAT_DEGREE) * 1e6) / 1e6,
    lng: Math.round((139.755 + eastKm / KM_PER_LNG_DEGREE) * 1e6) / 1e6,
  };
}

function micro(point: { lat: number; lng: number }): [number, number] {
  return [Math.round(point.lat * 1e6), Math.round(point.lng * 1e6)];
}

/**
 * 1メートル間隔で北へ伸びる直線の道と、東へ伸びる枝を持つ。
 * ノード1が起点、ノード3が分岐点、ノード5が北の終点、ノード7が東の終点。
 */
function lineArtifact(): WalkNetworkArtifact {
  const points = [
    { id: 1, ...at(0) },
    { id: 2, ...at(0.01) },
    { id: 3, ...at(0.02) },
    { id: 4, ...at(0.03) },
    { id: 5, ...at(0.04) },
    { id: 6, ...at(0.03, 0.01) },
    { id: 7, ...at(0.03, 0.02) },
  ];
  const edges: Array<[number, number]> = [
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [4, 6],
    [6, 7],
  ];
  return {
    version: WALK_NETWORK_VERSION,
    nodes: points.map((point) => [point.id, ...micro(point)]),
    edges,
  };
}

describe("parseWalkNetwork", () => {
  it("正しいartifactを受け付ける", () => {
    const parsed = parseWalkNetwork(JSON.parse(serializeWalkNetwork(lineArtifact())));

    expect(parsed.nodes).toHaveLength(7);
    expect(parsed.edges).toHaveLength(6);
  });

  it("versionが違えば拒否する", () => {
    expect(() => parseWalkNetwork({ version: 2, nodes: [], edges: [] })).toThrow(
      "version",
    );
  });

  it("nodesの要素が3つでなければ拒否する", () => {
    expect(() =>
      parseWalkNetwork({ version: 1, nodes: [[1, 2]], edges: [] }),
    ).toThrow("nodes[0]");
  });

  it("edgesの端点がnodesに無ければ拒否する", () => {
    expect(() =>
      parseWalkNetwork({
        version: 1,
        nodes: [[1, 35695000, 139755000]],
        edges: [[1, 2]],
      }),
    ).toThrow("edges[0]");
  });

  it("同じノードIDの重複を拒否する", () => {
    expect(() =>
      parseWalkNetwork({
        version: 1,
        nodes: [
          [1, 35695000, 139755000],
          [1, 35695100, 139755000],
        ],
        edges: [],
      }),
    ).toThrow("nodes に同じIDが2回現れます");
  });
});

describe("serializeWalkNetwork", () => {
  it("1要素を1行に書き、IDの昇順に並べる", () => {
    const text = serializeWalkNetwork({
      version: 1,
      nodes: [
        [9, 35696000, 139755000],
        [1, 35695000, 139755000],
      ],
      edges: [[9, 1]],
    });
    const lines = text.split("\n");

    expect(lines).toContain("    [1,35695000,139755000],");
    expect(lines).toContain("    [9,35696000,139755000]");
    expect(lines).toContain("    [1,9]");
  });

  it("読み戻すと同じ内容になる", () => {
    const artifact = lineArtifact();
    const roundTripped = parseWalkNetwork(
      JSON.parse(serializeWalkNetwork(artifact)),
    );

    expect(roundTripped.nodes).toEqual(
      [...artifact.nodes].sort((first, second) => first[0] - second[0]),
    );
    expect(roundTripped.edges).toEqual(
      [...artifact.edges].sort((first, second) => first[0] - second[0] || first[1] - second[1]),
    );
  });
});

describe("buildWalkGraph", () => {
  it("エッジを両方向の隣接リストにする", () => {
    const graph = buildWalkGraph(lineArtifact());
    const offsets = Array.from(graph.offsets);

    expect(offsets).toHaveLength(8);
    expect(offsets[7]).toBe(12);
  });

  it("エッジの長さを座標から計算する", () => {
    const graph = buildWalkGraph(lineArtifact());
    const from = graph.indexOfId.get(1) as number;
    const to = graph.indexOfId.get(2) as number;
    const edge = Array.from(
      { length: graph.offsets[from + 1] - graph.offsets[from] },
      (_, index) => graph.offsets[from] + index,
    ).find((index) => graph.targets[index] === to) as number;

    expect(graph.weights[edge]).toBeCloseTo(0.01, 4);
  });
});

describe("snapToNetwork", () => {
  it("最寄りのノードと距離を返す", () => {
    const graph = buildWalkGraph(lineArtifact());
    const snap = snapToNetwork(graph, at(0.02, 0.0004));

    expect(graph.indexOfId.get(3)).toBe(snap.node);
    expect(snap.km).toBeGreaterThan(0);
    expect(snap.km).toBeLessThan(0.05);
  });

  it("ノードの上にある点は距離0になる", () => {
    const graph = buildWalkGraph(lineArtifact());

    expect(snapToNetwork(graph, at(0.02)).km).toBeCloseTo(0, 9);
  });
});

describe("searchFrom", () => {
  it("分岐を越えて遠いノードまでの距離を返す", () => {
    const graph = buildWalkGraph(lineArtifact());
    const source = graph.indexOfId.get(1) as number;
    const north = graph.indexOfId.get(5) as number;
    const east = graph.indexOfId.get(7) as number;
    const { distances } = searchFrom(graph, source);

    expect(distances[north]).toBeCloseTo(0.04, 4);
    expect(distances[east]).toBeCloseTo(0.05, 4);
  });

  it("上限を超える距離を打ち切る", () => {
    const graph = buildWalkGraph(lineArtifact());
    const source = graph.indexOfId.get(1) as number;
    const east = graph.indexOfId.get(7) as number;
    const { distances } = searchFrom(graph, source, { limitKm: 0.045 });

    expect(distances[east]).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("walkRoute", () => {
  it("通過したノードを順に並べた折れ線を返す", () => {
    const graph = buildWalkGraph(lineArtifact());
    const route = walkRoute(graph, at(0), at(0.03, 0.02));

    expect(route).not.toBeNull();
    const path = (route as NonNullable<typeof route>).path;
    expect(path.length).toBeGreaterThanOrEqual(3);
  });

  it("折れ線の両端は道の上のノードで、地点そのものを含まない", () => {
    const graph = buildWalkGraph(lineArtifact());
    // ノード1の東へ約40メートル離れた地点から歩き始める。
    const start = { lat: at(0).lat, lng: at(0).lng + 0.04 / KM_PER_LNG_DEGREE };
    const route = walkRoute(graph, start, at(0.03, 0.02));

    expect(route).not.toBeNull();
    const path = (route as NonNullable<typeof route>).path;
    const nodeCoordinates = new Set(
      Array.from(graph.longitude, (lng, node) => `${lng},${graph.latitude[node]}`),
    );
    expect(path.every(([lng, lat]) => nodeCoordinates.has(`${lng},${lat}`))).toBe(true);
    expect(path).not.toContainEqual([start.lng, start.lat]);
    expect(path[path.length - 1]).toEqual([at(0.03, 0.02).lng, at(0.03, 0.02).lat]);
  });

  it("同じノードに接続する2地点の折れ線は1点になる", () => {
    const graph = buildWalkGraph(lineArtifact());
    // ノード3の東西3メートル。どちらも最寄りはノード3になる。
    const from = { lat: at(0.02).lat, lng: at(0.02).lng - 0.003 / KM_PER_LNG_DEGREE };
    const to = { lat: at(0.02).lat, lng: at(0.02).lng + 0.003 / KM_PER_LNG_DEGREE };

    const route = walkRoute(graph, from, to);

    expect(route).not.toBeNull();
    expect((route as NonNullable<typeof route>).path).toEqual([
      [at(0.02).lng, at(0.02).lat],
    ]);
  });

  it("同じノードに接続しても徒歩距離は両端の接続区間を含む", () => {
    const graph = buildWalkGraph(lineArtifact());
    const from = { lat: at(0.02).lat, lng: at(0.02).lng - 0.003 / KM_PER_LNG_DEGREE };
    const to = { lat: at(0.02).lat, lng: at(0.02).lng + 0.003 / KM_PER_LNG_DEGREE };

    const distance = walkRoute(graph, from, to)?.distanceKm as number;

    expect(distance).toBeCloseTo(0.006, 2);
    expect(distance).toBeGreaterThan(0.005);
  });

  it("経路の長さは直線距離より長い", () => {
    const graph = buildWalkGraph(lineArtifact());
    const route = walkRoute(graph, at(0), at(0.03, 0.02));

    expect((route as NonNullable<typeof route>).distanceKm).toBeGreaterThan(
      haversineKm(at(0), at(0.03, 0.02)),
    );
  });

  it("折れ線を求めないときは座標列を返さない", () => {
    const graph = buildWalkGraph(lineArtifact());
    const route = walkRoute(graph, at(0), at(0.03, 0.02), { path: false });

    expect((route as NonNullable<typeof route>).path).toEqual([]);
    expect((route as NonNullable<typeof route>).distanceKm).toBeGreaterThan(0);
  });

  it("向きを入れ替えても距離が同じになる", () => {
    const graph = buildWalkGraph(lineArtifact());
    const forward = walkRoute(graph, at(0), at(0.03, 0.02))?.distanceKm;
    const backward = walkRoute(graph, at(0.03, 0.02), at(0))?.distanceKm;

    expect(forward).toBeCloseTo(backward as number, 9);
  });
});

describe("walkDistanceKm", () => {
  it("接続区間を距離に含める", () => {
    const graph = buildWalkGraph(lineArtifact());
    // ノード1の東へ約40メートル離れた点から、ノード1まで歩く分が加算される。
    const offset = 0.04 / KM_PER_LNG_DEGREE;
    const near = { lat: at(0).lat, lng: at(0).lng + offset };

    expect(walkDistanceKm(graph, near, at(0.02))).toBeGreaterThan(0.05);
    expect(walkDistanceKm(graph, near, at(0.02))).toBeLessThan(0.08);
  });

  it("ノードの上にある2地点はネットワーク上の距離だけになる", () => {
    const graph = buildWalkGraph(lineArtifact());

    expect(walkDistanceKm(graph, at(0), at(0.04))).toBeCloseTo(0.04, 3);
  });

  it("直線距離に√2を掛けた値と一致しない", () => {
    const graph = buildWalkGraph(lineArtifact());
    const straight = haversineKm(at(0), at(0.03, 0.02));

    expect(walkDistanceKm(graph, at(0), at(0.03, 0.02))).not.toBeCloseTo(
      straight * Math.SQRT2,
      3,
    );
  });
});

describe("loadWalkNetwork", () => {
  const text = serializeWalkNetwork(lineArtifact());

  it("artifactを読み込んで探索できる形にする", () => {
    const loaded = loadWalkNetwork("data/walk-network.json", () => text);

    expect(loaded.status).toBe("success");
    if (loaded.status === "success") {
      expect(loaded.network.latitude).toHaveLength(7);
    }
  });

  it("ファイルがないときは失敗を返す", () => {
    const loaded = loadWalkNetwork("data/walk-network.json", () => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    expect(loaded.status).toBe("error");
  });

  it("JSONとして壊れているときは失敗を返す", () => {
    const loaded = loadWalkNetwork("data/walk-network.json", () => "{");

    expect(loaded.status).toBe("error");
  });

  it("必須の配列がないときは失敗を返す", () => {
    const loaded = loadWalkNetwork("data/walk-network.json", () =>
      JSON.stringify({ version: 1 }),
    );

    expect(loaded.status).toBe("error");
    if (loaded.status === "error") {
      expect(loaded.error.message).toContain("nodes");
    }
  });

  it("端点が欠けたエッジを拒否する", () => {
    const loaded = loadWalkNetwork("data/walk-network.json", () =>
      JSON.stringify({
        version: 1,
        nodes: [[1, 35695000, 139755000]],
        edges: [[1, 99]],
      }),
    );

    expect(loaded.status).toBe("error");
  });
});

describe("getWalkNetwork", () => {
  afterEach(() => {
    resetWalkNetworkCache();
  });

  it("読み込めないときは例外を投げ、直線距離へ切り替えない", () => {
    expect(() =>
      getWalkNetwork("/definitely/not/here/walk-network.json"),
    ).toThrow("徒歩ネットワークを読み込めません");
  });
});
