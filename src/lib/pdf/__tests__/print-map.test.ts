import { Bus, MapPin } from "lucide";
import {
  PRINT_MAP_ATTRIBUTION,
  PRINT_MAP_CSS,
  PRINT_MAP_LINE_PAINT,
  PRINT_MAP_MARKER_ICONS,
  PRINT_MAP_MIN_SPAN_METERS,
  PRINT_MAP_STYLE_URL,
  buildPrintMapDrawing,
  buildPrintMapHtml,
  drawPrintMaps,
  printMapBounds,
  printMapPath,
  renderPrintMapIcon,
  type PrintMapLeg,
  type PrintMapPage,
} from "../print-map";

const originLeg: PrintMapLeg = {
  id: "origin",
  start: { label: "出発地", position: [139.7532, 35.6941], kind: "place" },
  end: { label: "千代田区役所", position: [139.7559, 35.6925], kind: "stop" },
};

const destinationLeg: PrintMapLeg = {
  id: "destination",
  start: { label: "千代田区役所", position: [139.7559, 35.6925], kind: "stop" },
  end: { label: "目的地", position: [139.7599, 35.6901], kind: "place" },
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
  it("折れ線がなければ線を引く座標を返さない", () => {
    expect(printMapPath(originLeg)).toEqual([]);
  });

  it("折れ線があればその座標をそのまま返す", () => {
    const path: [number, number][] = [
      [139.7532, 35.6941],
      [139.754, 35.6935],
      [139.7559, 35.6925],
    ];
    expect(printMapPath({ ...originLeg, path })).toEqual(path);
  });

  it("1点だけの折れ線もそのまま返し、線を引くかは点の数で決める", () => {
    expect(printMapPath({ ...originLeg, path: [[139.7532, 35.6941]] })).toEqual([
      [139.7532, 35.6941],
    ]);
  });
});

describe("printMapBounds", () => {
  it("経度と緯度を取り違えずに範囲を求める", () => {
    const bounds = printMapBounds({
      ...originLeg,
      path: [
        [139.7532, 35.6941],
        [139.7599, 35.6901],
      ],
    });
    expect(bounds.west).toBeLessThanOrEqual(139.7532);
    expect(bounds.east).toBeGreaterThanOrEqual(139.7599);
    expect(bounds.south).toBeLessThanOrEqual(35.6901);
    expect(bounds.north).toBeGreaterThanOrEqual(35.6941);
  });

  it("折れ線の中間点が端より外にあっても範囲に含める", () => {
    const bounds = printMapBounds({
      ...originLeg,
      path: [
        [139.7532, 35.6941],
        [139.7650, 35.6890],
        [139.7559, 35.6925],
      ],
    });
    expect(bounds.east).toBeGreaterThanOrEqual(139.765);
    expect(bounds.south).toBeLessThanOrEqual(35.689);
  });

  it("折れ線が1点でも両端の地点を含める", () => {
    const bounds = printMapBounds({
      id: "destination",
      start: { label: "停留所", position: [139.74, 35.685], kind: "stop" },
      end: { label: "目的地", position: [139.7399, 35.6858], kind: "place" },
      path: [[139.7402, 35.6858]],
    });

    expect(bounds.west).toBeLessThanOrEqual(139.7399);
    expect(bounds.east).toBeGreaterThanOrEqual(139.7402);
    expect(bounds.south).toBeLessThanOrEqual(35.685);
    expect(bounds.north).toBeGreaterThanOrEqual(35.6858);
  });

  it("地点が近くても東西と南北の幅を200メートル以上にする", () => {
    const bounds = printMapBounds(originLeg);
    const latitudeSpanMeters = (bounds.north - bounds.south) * 111_195;
    const longitudeSpanMeters =
      (bounds.east - bounds.west) *
      111_195 *
      Math.cos((((bounds.north + bounds.south) / 2) * Math.PI) / 180);

    expect(PRINT_MAP_MIN_SPAN_METERS).toBe(200);
    expect(latitudeSpanMeters).toBeGreaterThanOrEqual(PRINT_MAP_MIN_SPAN_METERS - 0.001);
    expect(longitudeSpanMeters).toBeGreaterThanOrEqual(PRINT_MAP_MIN_SPAN_METERS - 0.001);
  });

  it("200メートルへ広げても中心を保つ", () => {
    const leg: PrintMapLeg = {
      id: "origin",
      start: { label: "出発地", position: [139.75, 35.69], kind: "place" },
      end: { label: "停留所", position: [139.7502, 35.6902], kind: "stop" },
    };
    const bounds = printMapBounds(leg);

    expect((bounds.west + bounds.east) / 2).toBeCloseTo(139.7501, 6);
    expect((bounds.south + bounds.north) / 2).toBeCloseTo(35.6901, 6);
  });
});

describe("buildPrintMapDrawing", () => {
  it("描画に必要な範囲と折れ線と端点をまとめる", () => {
    const drawing = buildPrintMapDrawing(originLeg);
    expect(drawing.id).toBe("origin");
    expect(drawing.start.label).toBe("出発地");
    expect(drawing.end.label).toBe("千代田区役所");
    expect(drawing.path).toEqual([]);
    expect(drawing.hasLine).toBe(false);
    expect(drawing.bounds.west).toBeLessThanOrEqual(139.7532);
    expect(drawing.bounds.east).toBeGreaterThanOrEqual(139.7559);
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
      start: { label: '<script>"x"</script>', position: [139.75, 35.69], kind: "place" },
      end: { label: "停留所", position: [139.76, 35.69], kind: "stop" },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("PRINT_MAP_CSS", () => {
  it("出典の文字を地図の上に重ねない", () => {
    expect(PRINT_MAP_CSS).not.toMatch(/\.print-map-attribution\s*\{[^}]*position:\s*absolute/);
  });

  it("マーカーの位置合わせをCSSで上書きしない", () => {
    expect(PRINT_MAP_CSS).not.toMatch(/\.print-map-marker\s*\{[^}]*transform:/);
  });

  it("停留所は黒地、地点は白地で塗り分ける", () => {
    expect(PRINT_MAP_CSS).toMatch(
      /\.print-map-marker\s*\{[^}]*background-color:\s*#111111/,
    );
    expect(PRINT_MAP_CSS).toMatch(
      /\.print-map-marker\[data-kind="place"\]\s*\{[^}]*background-color:\s*#ffffff/,
    );
  });

  it("アイコンを16ピクセルで描く", () => {
    expect(PRINT_MAP_CSS).toMatch(/\.print-map-marker svg\s*\{[^}]*width:\s*16px/);
    expect(PRINT_MAP_CSS).toMatch(/\.print-map-marker svg\s*\{[^}]*height:\s*16px/);
  });
});

describe("PRINT_MAP_MARKER_ICONS", () => {
  it("停留所はバス、地点は地図ピンの図形で描く", () => {
    expect(PRINT_MAP_MARKER_ICONS.stop).toBe(
      renderPrintMapIcon(Bus),
    );
    expect(PRINT_MAP_MARKER_ICONS.place).toBe(
      renderPrintMapIcon(MapPin),
    );
    expect(PRINT_MAP_MARKER_ICONS.stop).not.toBe(PRINT_MAP_MARKER_ICONS.place);
  });

  it("バスの図形は車体と車輪を持つ", () => {
    expect(PRINT_MAP_MARKER_ICONS.stop).toContain('d="M2 12h19.6"');
    expect(PRINT_MAP_MARKER_ICONS.stop).toContain('<circle cx="7" cy="18" r="2" />');
  });

  it("地図ピンの図形は丸い穴を持つ", () => {
    expect(PRINT_MAP_MARKER_ICONS.place).toContain('<circle cx="12" cy="10" r="3" />');
  });

  it("アイコンに地名の文字を混ぜない", () => {
    expect(PRINT_MAP_MARKER_ICONS.stop).not.toContain("出発地");
    expect(PRINT_MAP_MARKER_ICONS.place).not.toContain("目的地");
    expect(PRINT_MAP_MARKER_ICONS.stop.startsWith("<svg")).toBe(true);
    expect(PRINT_MAP_MARKER_ICONS.place.startsWith("<svg")).toBe(true);
  });

  it("アイコンの一辺を16ピクセルにする", () => {
    expect(PRINT_MAP_MARKER_ICONS.stop).toContain('width="16"');
    expect(PRINT_MAP_MARKER_ICONS.stop).toContain('height="16"');
    expect(PRINT_MAP_MARKER_ICONS.place).toContain('width="16"');
    expect(PRINT_MAP_MARKER_ICONS.place).toContain('height="16"');
  });

  it("アイコンを読み上げの対象にしない", () => {
    expect(PRINT_MAP_MARKER_ICONS.stop).toContain('aria-hidden="true"');
    expect(PRINT_MAP_MARKER_ICONS.place).toContain('aria-hidden="true"');
  });
});

describe("PRINT_MAP_LINE_PAINT", () => {
  it("実在の徒歩経路は実線で描く", () => {
    expect(PRINT_MAP_LINE_PAINT).not.toHaveProperty("line-dasharray");
    expect(PRINT_MAP_LINE_PAINT["line-color"]).toBe("#111111");
  });
});

describe("buildPrintMapDrawing", () => {
  it("折れ線をそのまま描画対象にし、線を引くかを点の数で決める", () => {
    const drawing = buildPrintMapDrawing({
      id: "origin",
      start: { label: "出発地", position: [139.75, 35.69], kind: "place" },
      end: { label: "停留所", position: [139.76, 35.7], kind: "stop" },
      path: [
        [139.75, 35.69],
        [139.755, 35.695],
        [139.76, 35.7],
      ],
    });

    expect(drawing.path).toHaveLength(3);
    expect(drawing.hasLine).toBe(true);
  });

  it("折れ線が無い区間は線を引かない", () => {
    const drawing = buildPrintMapDrawing({
      id: "origin",
      start: { label: "出発地", position: [139.75, 35.69], kind: "place" },
      end: { label: "停留所", position: [139.76, 35.7], kind: "stop" },
    });

    expect(drawing.hasLine).toBe(false);
    expect(drawing.path).toEqual([]);
  });

  it("1点だけの折れ線は線を引かないが、その地点は画面上の位置として持つ", () => {
    const drawing = buildPrintMapDrawing({
      id: "destination",
      start: { label: "停留所", position: [139.74, 35.685], kind: "stop" },
      end: { label: "目的地", position: [139.7399, 35.6858], kind: "place" },
      path: [[139.7402, 35.6858]],
    });

    expect(drawing.hasLine).toBe(false);
    expect(drawing.path).toEqual([[139.7402, 35.6858]]);
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
