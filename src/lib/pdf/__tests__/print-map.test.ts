import {
  PRINT_MAP_ATTRIBUTION,
  PRINT_MAP_CSS,
  PRINT_MAP_LINE_PAINT,
  PRINT_MAP_STYLE_URL,
  buildPrintMapDrawing,
  buildPrintMapHtml,
  drawPrintMaps,
  printMapBounds,
  printMapPath,
  type PrintMapLeg,
  type PrintMapPage,
} from "../print-map";

const originLeg: PrintMapLeg = {
  id: "origin",
  start: { label: "出発地", position: [139.7532, 35.6941] },
  end: { label: "千代田区役所", position: [139.7559, 35.6925] },
};

const destinationLeg: PrintMapLeg = {
  id: "destination",
  start: { label: "千代田区役所", position: [139.7559, 35.6925] },
  end: { label: "目的地", position: [139.7599, 35.6901] },
};

function createPage(
  evaluate: PrintMapPage["evaluate"] = jest.fn().mockResolvedValue({
    ok: true,
    failed: [],
  }),
): jest.Mocked<PrintMapPage> {
  return {
    addStyleTag: jest.fn().mockResolvedValue(undefined),
    addScriptTag: jest.fn().mockResolvedValue(undefined),
    evaluate,
  } as unknown as jest.Mocked<PrintMapPage>;
}

describe("printMapPath", () => {
  it("折れ線がなければ始点と終点の2点をこの順で返す", () => {
    expect(printMapPath(originLeg)).toEqual([
      [139.7532, 35.6941],
      [139.7559, 35.6925],
    ]);
  });

  it("折れ線があればその座標をそのまま返す", () => {
    const path: [number, number][] = [
      [139.7532, 35.6941],
      [139.754, 35.6935],
      [139.7559, 35.6925],
    ];
    expect(printMapPath({ ...originLeg, path })).toEqual(path);
  });

  it("2点未満の折れ線は無いものとして扱う", () => {
    expect(printMapPath({ ...originLeg, path: [[139.7532, 35.6941]] })).toEqual([
      [139.7532, 35.6941],
      [139.7559, 35.6925],
    ]);
  });
});

describe("printMapBounds", () => {
  it("経度と緯度を取り違えずに範囲を求める", () => {
    const bounds = printMapBounds([
      [139.7532, 35.6941],
      [139.7599, 35.6901],
    ]);
    expect(bounds.west).toBeCloseTo(139.7532, 6);
    expect(bounds.east).toBeCloseTo(139.7599, 6);
    expect(bounds.south).toBeCloseTo(35.6901, 6);
    expect(bounds.north).toBeCloseTo(35.6941, 6);
  });

  it("折れ線の中間点が端より外にあっても範囲に含める", () => {
    const bounds = printMapBounds([
      [139.7532, 35.6941],
      [139.7650, 35.6890],
      [139.7559, 35.6925],
    ]);
    expect(bounds.east).toBeCloseTo(139.765, 6);
    expect(bounds.south).toBeCloseTo(35.689, 6);
  });
});

describe("buildPrintMapDrawing", () => {
  it("描画に必要な範囲と折れ線と端点をまとめる", () => {
    const drawing = buildPrintMapDrawing(originLeg);
    expect(drawing.id).toBe("origin");
    expect(drawing.start.label).toBe("出発地");
    expect(drawing.end.label).toBe("千代田区役所");
    expect(drawing.path).toHaveLength(2);
    expect(drawing.bounds.west).toBeCloseTo(139.7532, 6);
  });
});

describe("buildPrintMapHtml", () => {
  it("描画先と読み上げ用の説明を持つ", () => {
    const html = buildPrintMapHtml(originLeg);
    expect(html).toContain('data-print-map="origin"');
    expect(html).toContain('role="img"');
    expect(html).toContain("出発地から千代田区役所までの地図");
  });

  it("紙面の出典を地図の枠の中に含める", () => {
    const html = buildPrintMapHtml(originLeg);
    expect(html).toContain(PRINT_MAP_ATTRIBUTION);
    expect(PRINT_MAP_ATTRIBUTION).toContain("OpenMapTiles");
    expect(PRINT_MAP_ATTRIBUTION).toContain("OpenFreeMap");
    expect(PRINT_MAP_ATTRIBUTION).toContain("OpenStreetMap contributors");
    expect(PRINT_MAP_ATTRIBUTION).toContain("ODbL-1.0");
  });

  it("名前の記号をHTMLとして解釈させない", () => {
    const html = buildPrintMapHtml({
      id: "origin",
      start: { label: '<script>"x"</script>', position: [139.75, 35.69] },
      end: { label: "停留所", position: [139.76, 35.69] },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("PRINT_MAP_CSS", () => {
  it("出典の文字を地図の上に重ねない", () => {
    expect(PRINT_MAP_CSS).not.toMatch(/\.print-map-attribution\s*\{[^}]*position:\s*absolute/);
  });

  it("出典の文字を地図の上に重ねない", () => {
    expect(PRINT_MAP_CSS).not.toMatch(/\.print-map-attribution\s*\{[^}]*position:\s*absolute/);
  });
});

describe("PRINT_MAP_LINE_PAINT", () => {
  it("徒歩区間を実経路と読み違えないよう破線にする", () => {
    expect(PRINT_MAP_LINE_PAINT["line-dasharray"]).toEqual([2, 1.5]);
    expect(PRINT_MAP_LINE_PAINT["line-color"]).toBe("#111111");
  });
});

describe("drawPrintMaps", () => {
  it("地図が無ければ何も読み込まずに成功を返す", async () => {
    const page = createPage();
    await expect(drawPrintMaps(page, [])).resolves.toEqual({ ok: true });
    expect(page.addScriptTag).not.toHaveBeenCalled();
  });

  it("地図ごとに描画を依頼し、成功を返す", async () => {
    const page = createPage();
    await expect(drawPrintMaps(page, [originLeg, destinationLeg])).resolves.toEqual({
      ok: true,
    });
    expect(page.addScriptTag).toHaveBeenCalledTimes(1);
    const [callback, input] = page.evaluate.mock.calls[0];
    expect(input.styleUrl).toBe(PRINT_MAP_STYLE_URL);
    expect(input.drawings.map((drawing) => drawing.id)).toEqual([
      "origin",
      "destination",
    ]);
    expect(typeof callback).toBe("function");
  });

  it("描画の失敗を例外にせず、失敗した地図の識別子ごと返す", async () => {
    const page = createPage(
      jest.fn().mockResolvedValue({
        ok: false,
        failed: [{ id: "destination", reason: "timeout" }],
      }),
    );
    await expect(drawPrintMaps(page, [originLeg, destinationLeg])).resolves.toEqual({
      ok: false,
      reason: "timeout",
      failedIds: ["destination"],
    });
  });

  it("MapLibreを読み込めない場合も失敗として返す", async () => {
    const page = createPage();
    page.addScriptTag.mockRejectedValueOnce(new Error("injection failed"));
    await expect(drawPrintMaps(page, [originLeg])).resolves.toEqual({
      ok: false,
      reason: "injection failed",
      failedIds: ["origin"],
    });
  });

  it("1枚でも失敗すれば部分的な成功として扱わない", async () => {
    const page = createPage(
      jest.fn().mockResolvedValue({
        ok: false,
        failed: [
          { id: "origin", reason: "timeout" },
          { id: "destination", reason: "map-error" },
        ],
      }),
    );
    const result = await drawPrintMaps(page, [originLeg, destinationLeg]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedIds).toEqual(["origin", "destination"]);
    }
  });
});
