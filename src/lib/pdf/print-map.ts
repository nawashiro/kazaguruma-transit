/**
 * 印刷地図の描画指定を組み立て、PuppeteerのページへMapLibreを注入して描く。
 *
 * 地図タイルはOpenFreeMapの公開インスタンスから取得する。同サービスは
 * 印刷物での利用を許可しているが可用性の保証はなく、帰属表示は
 * MapLibreの自動挿入の対象外になるため、紙面へ自前で表示する。
 *
 * https://openfreemap.org/
 */

export const PRINT_MAP_STYLE_URL =
  "https://tiles.openfreemap.org/styles/positron";

export const PRINT_MAP_ATTRIBUTION =
  "OpenFreeMap © OpenMapTiles · Data from OpenStreetMap contributors · ODbL-1.0";

/** 描画の待ち時間の上限。実測では1枚あたり約1.8秒で完了する。 */
export const PRINT_MAP_TIMEOUT_MS = 20_000;

/**
 * 徒歩区間の線。破線にするのは、直線が実在の歩行経路ではないことを
 * 線種で示すためで、地図の描画側とテストで同じ指定を共有する。
 */
export const PRINT_MAP_LINE_PAINT = {
  "line-color": "#111111",
  "line-width": 3,
  "line-dasharray": [2, 1.5],
} as const;

/**
 * ブラウザ側の上限が働かない場合に備えた、プロセス側の打ち切り。
 * ページが応答しなくなっても、利用者を待たせ続けない。
 */
const PRINT_MAP_BACKSTOP_MS = PRINT_MAP_TIMEOUT_MS + 5_000;

const MAP_WORKER_SCRIPT = "node_modules/maplibre-gl/dist/maplibre-gl.js";
const MAP_WORKER_STYLE = "node_modules/maplibre-gl/dist/maplibre-gl.css";

/** GeoJSONと同じく [経度, 緯度] の順で持つ。 */
export type LngLat = readonly [number, number];

export interface PrintMapEndpoint {
  readonly label: string;
  readonly position: LngLat;
}

export interface PrintMapLeg {
  /** 地図の描画先を指す識別子。HTMLの data 属性になる。 */
  readonly id: string;
  readonly start: PrintMapEndpoint;
  readonly end: PrintMapEndpoint;
  /** 徒歩経路の折れ線。無い場合は始点と終点を結ぶ直線を描く。 */
  readonly path?: readonly LngLat[];
}

export interface PrintMapBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface PrintMapDrawing {
  readonly id: string;
  readonly bounds: PrintMapBounds;
  readonly path: readonly LngLat[];
  readonly start: PrintMapEndpoint;
  readonly end: PrintMapEndpoint;
}

export type PrintMapDrawResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly failedIds: readonly string[];
    };

/**
 * PuppeteerのPageのうち、地図の描画に使う操作だけを表す。
 * 単体テストで実物のブラウザを起動せずに差し替えられるようにする。
 */
export interface PrintMapPage {
  addStyleTag(options: { path: string }): Promise<unknown>;
  addScriptTag(options: { path: string }): Promise<unknown>;
  evaluate<R>(
    pageFunction: (input: {
      styleUrl: string;
      drawings: readonly PrintMapDrawing[];
      timeoutMs: number;
      linePaint: Readonly<Record<string, unknown>>;
    }) => Promise<R>,
    input: {
      styleUrl: string;
      drawings: readonly PrintMapDrawing[];
      timeoutMs: number;
      linePaint: Readonly<Record<string, unknown>>;
    },
  ): Promise<R>;
}

export function escapePrintMapHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * 描く折れ線を返す。折れ線が与えられていればそれを、無ければ
 * 始点と終点を結ぶ2点を返す。描画側はこの戻り値だけを見る。
 */
export function printMapPath(leg: PrintMapLeg): readonly LngLat[] {
  if (leg.path !== undefined && leg.path.length >= 2) {
    return leg.path;
  }
  return [leg.start.position, leg.end.position];
}

export function printMapBounds(path: readonly LngLat[]): PrintMapBounds {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [lng, lat] of path) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  if (!Number.isFinite(west)) {
    return { west: 0, south: 0, east: 0, north: 0 };
  }
  return { west, south, east, north };
}

export function buildPrintMapDrawing(leg: PrintMapLeg): PrintMapDrawing {
  const path = printMapPath(leg);
  return {
    id: leg.id,
    bounds: printMapBounds(path),
    path,
    start: leg.start,
    end: leg.end,
  };
}

export function buildPrintMapHtml(leg: PrintMapLeg): string {
  const label = escapePrintMapHtml(
    `${leg.start.label}から${leg.end.label}までの地図`,
  );
  return `
      <div class="print-map-frame">
        <div class="print-map" data-print-map="${escapePrintMapHtml(leg.id)}" role="img" aria-label="${label}"></div>
        <p class="print-map-attribution">${PRINT_MAP_ATTRIBUTION}</p>
      </div>
    `;
}

export const PRINT_MAP_CSS = `
  .print-map-frame { position: relative; max-width: 600px; margin: 0 auto; }
  .print-map { width: 100%; height: 200px; border-radius: 0.25rem; border: 1px solid #e5e7eb; overflow: hidden; background-color: #f2f3f0; }
  .print-map-attribution { margin: 0.25rem 0 0; font-size: 0.75rem; color: #4b5563; }
  .print-map-marker { transform: translate(-50%, -100%); background-color: #111111; color: #ffffff; border-radius: 9999px; padding: 1px 6px; font-size: 0.75rem; white-space: nowrap; }
  .print-map-marker.is-end { background-color: #ffffff; color: #111111; border: 2px solid #111111; }
`;

/**
 * ページの中で地図を描く。この関数はpage.evaluateへ渡すため、
 * 外部の変数を参照せず、引数だけで完結させる。
 */
async function renderPrintMapsInPage(input: {
  styleUrl: string;
  drawings: readonly PrintMapDrawing[];
  timeoutMs: number;
  linePaint: Readonly<Record<string, unknown>>;
}): Promise<{
  ok: boolean;
  failed: Array<{ id: string; reason: string }>;
}> {
  const mapApi = (
    window as unknown as {
      maplibregl: {
        Map: new (options: unknown) => {
          on(event: string, handler: (event?: unknown) => void): void;
          addSource(id: string, source: unknown): void;
          addLayer(layer: unknown): void;
        };
        Marker: new (options: unknown) => {
          setLngLat(position: readonly [number, number]): {
            addTo(map: unknown): void;
          };
        };
      };
    }
  ).maplibregl;

  if (mapApi === undefined) {
    return {
      ok: false,
      failed: input.drawings.map((drawing) => ({
        id: drawing.id,
        reason: "maplibre-unavailable",
      })),
    };
  }

  const drawings = input.drawings;
  const results = await Promise.all(
    drawings.map(
      (drawing) =>
        new Promise<{ id: string; reason?: string }>((resolve) => {
          const container = document.querySelector(
            `[data-print-map="${drawing.id}"]`,
          );
          if (container === null) {
            resolve({ id: drawing.id, reason: "container-missing" });
            return;
          }

          let settled = false;
          const settle = (reason?: string) => {
            if (settled) {
              return;
            }
            settled = true;
            resolve(reason === undefined ? { id: drawing.id } : { id: drawing.id, reason });
          };
          const timer = window.setTimeout(
            () => settle("timeout"),
            input.timeoutMs,
          );

          let map: {
            on(event: string, handler: (event?: unknown) => void): void;
            addSource(id: string, source: unknown): void;
            addLayer(layer: unknown): void;
          };
          try {
            map = new mapApi.Map({
              container,
              style: input.styleUrl,
              bounds: [
                [drawing.bounds.west, drawing.bounds.south],
                [drawing.bounds.east, drawing.bounds.north],
              ],
              fitBoundsOptions: { padding: 48 },
              interactive: false,
              attributionControl: false,
              preserveDrawingBuffer: true,
            });
          } catch (error) {
            window.clearTimeout(timer);
            settle(error instanceof Error ? error.message : "map-failed");
            return;
          }

          map.on("load", () => {
            map.addSource("walk", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: drawing.path },
              },
            });
            map.addLayer({
              id: "walk",
              type: "line",
              source: "walk",
              paint: input.linePaint,
            });
          });

          for (const endpoint of [drawing.start, drawing.end]) {
            const element = document.createElement("div");
            element.className = `print-map-marker${endpoint === drawing.end ? " is-end" : ""}`;
            element.textContent = endpoint.label;
            new mapApi.Marker({ element, anchor: "bottom" })
              .setLngLat(endpoint.position)
              .addTo(map);
          }

          map.on("idle", () => {
            window.clearTimeout(timer);
            void snapshot()
              .then(() => settle())
              .catch((error: unknown) =>
                settle(error instanceof Error ? error.message : "snapshot-failed"),
              );
          });

          /**
           * MapLibreの描画結果はWebGLのcanvasにあり、そのままでは印刷へ
           * 取り出せない。2Dのcanvasへ描き直し、imgに置き換えてから
           * 印刷させる。モノクロもこの時点で確定させる。
           */
          const snapshot = async () => {
            const source = container.querySelector("canvas");
            if (source === null) {
              throw new Error("canvas-missing");
            }
            const target = document.createElement("canvas");
            target.width = source.width;
            target.height = source.height;
            const context = target.getContext("2d");
            if (context === null) {
              throw new Error("canvas-context-missing");
            }
            context.filter = "grayscale(1)";
            context.drawImage(source, 0, 0);

            const image = new Image();
            image.src = target.toDataURL("image/png");
            image.style.width = "100%";
            image.style.height = "100%";
            image.style.display = "block";
            await image.decode();
            source.replaceWith(image);
            await new Promise<void>((resolve) =>
              window.requestAnimationFrame(() =>
                window.requestAnimationFrame(() => resolve()),
              ),
            );
          };

          map.on("error", (event) => {
            window.clearTimeout(timer);
            const detail = event as { error?: { message?: string } } | undefined;
            settle(detail?.error?.message ?? "map-error");
          });
        }),
    ),
  );

  const failed = results
    .filter((result): result is { id: string; reason: string } => result.reason !== undefined)
    .map((result) => ({ id: result.id, reason: result.reason }));
  return { ok: failed.length === 0, failed };
}

/**
 * すべての地図を描く。1枚でも描けなければ失敗を返し、例外は投げない。
 * 上限時間は地図ごとに設け、部分的な成功を成果物にしないため
 * 判定は全地図の完了後に行う。
 */
export async function drawPrintMaps(
  page: PrintMapPage,
  legs: readonly PrintMapLeg[],
  options: { timeoutMs?: number } = {},
): Promise<PrintMapDrawResult> {
  if (legs.length === 0) {
    return { ok: true };
  }

  const timeoutMs = options.timeoutMs ?? PRINT_MAP_TIMEOUT_MS;
  const drawings = legs.map(buildPrintMapDrawing);

  try {
    await page.addStyleTag({
      path: `${process.cwd()}/${MAP_WORKER_STYLE}`,
    });
    await page.addScriptTag({
      path: `${process.cwd()}/${MAP_WORKER_SCRIPT}`,
    });
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "map-library-unavailable",
      failedIds: legs.map((leg) => leg.id),
    };
  }

  let backstop: ReturnType<typeof setTimeout> | undefined;
  const rendered = await Promise.race([
    page.evaluate(renderPrintMapsInPage, {
      styleUrl: PRINT_MAP_STYLE_URL,
      drawings,
      timeoutMs,
      linePaint: PRINT_MAP_LINE_PAINT,
    }),
    new Promise<{ ok: false; reason: string; failed: Array<{ id: string; reason: string }> }>(
      (resolve) => {
        backstop = setTimeout(
          () =>
            resolve({
              ok: false,
              reason: "backstop-timeout",
              failed: legs.map((leg) => ({ id: leg.id, reason: "backstop-timeout" })),
            }),
          PRINT_MAP_BACKSTOP_MS,
        );
      },
    ),
  ]);
  clearTimeout(backstop);

  if (rendered.ok) {
    return { ok: true };
  }
  const failedIds = rendered.failed.map((entry) => entry.id);
  const reason = rendered.failed[0]?.reason ?? "map-failed";
  return { ok: false, reason, failedIds };
}
