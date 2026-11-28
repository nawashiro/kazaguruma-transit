/**
 * 印刷地図の描画指定を組み立て、PuppeteerのページへMapLibreを注入して描く。
 *
 * 地図タイルはOpenFreeMapの公開インスタンスから取得する。同サービスは
 * 印刷物での利用を許可しているが可用性の保証はなく、帰属表示は
 * MapLibreの自動挿入の対象外になるため、紙面へ自前で表示する。
 *
 * https://openfreemap.org/
 */

import { readFile } from "node:fs/promises";
import { Bus, MapPin, type IconNode } from "lucide";

export const PRINT_MAP_STYLE_URL =
  "https://tiles.openfreemap.org/styles/positron";

export const PRINT_MAP_ATTRIBUTION =
  "OpenFreeMap © OpenMapTiles · Data from OpenStreetMap contributors · ODbL-1.0";

/** 描画の待ち時間の上限。実測では1枚あたり約1.8秒で完了する。 */
export const PRINT_MAP_TIMEOUT_MS = 20_000;

/**
 * 実在の徒歩経路の線。徒歩ネットワークから得た折れ線を実線で描く。
 */
export const PRINT_MAP_LINE_PAINT = {
  "line-color": "#111111",
  "line-width": 3,
} as const;

/** マーカーのアイコンの一辺（ピクセル）。 */
export const PRINT_MAP_MARKER_ICON_SIZE = 16;

/**
 * Lucideの図形データをSVGの文字列にする。PuppeteerのページにはReactの
 * 実行環境がないため、ここで文字列へ直してから渡す。lucideの
 * `createElement`はDOMを要求するので、サーバー側では使えない。
 */
export function renderPrintMapIcon(iconNode: IconNode): string {
  const shapes = iconNode
    .map(([tag, attributes]) => {
      const rendered = Object.entries(attributes)
        .map(([name, value]) => `${name}="${escapePrintMapHtml(String(value))}"`)
        .join(" ");
      return `<${tag} ${rendered} />`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PRINT_MAP_MARKER_ICON_SIZE}" height="${PRINT_MAP_MARKER_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="print-map-icon">${shapes}</svg>`;
}

/**
 * 地点マーカーのアイコン。currentColorで描くため、色はマーカーの文字色で決まる。
 */
export const PRINT_MAP_MARKER_ICONS: Readonly<
  Record<PrintMapEndpointKind, string>
> = {
  stop: renderPrintMapIcon(Bus),
  place: renderPrintMapIcon(MapPin),
};

/**
 * 地図に写す範囲の最小の広がり（メートル）。地点が近いときに縮尺が寄り
 * すぎて周りの街区が読めなくなるのを防ぐ。
 */
export const PRINT_MAP_MIN_SPAN_METERS = 200;

const METERS_PER_DEGREE = 111_195;

/**
 * ブラウザ側の上限が働かない場合に備えた、プロセス側の打ち切り。
 * ページが応答しなくなっても、利用者を待たせ続けない。
 */
const PRINT_MAP_BACKSTOP_MS = PRINT_MAP_TIMEOUT_MS + 5_000;

const MAP_WORKER_SCRIPT = "node_modules/maplibre-gl/dist/maplibre-gl.mjs";
const MAP_WORKER_THREAD = "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs";
const MAP_WORKER_STYLE = "node_modules/maplibre-gl/dist/maplibre-gl.css";

/** GeoJSONと同じく [経度, 緯度] の順で持つ。 */
export type LngLat = readonly [number, number];

export interface PrintMapEndpoint {
  readonly label: string;
  readonly position: LngLat;
  /** 停留所か、出発地・目的地か。マーカーのアイコンの形を決める。 */
  readonly kind: PrintMapEndpointKind;
}

export type PrintMapEndpointKind = "stop" | "place";

export interface PrintMapLeg {
  /** 地図の描画先を指す識別子。HTMLの data 属性になる。 */
  readonly id: string;
  readonly start: PrintMapEndpoint;
  readonly end: PrintMapEndpoint;
  /** 徒歩ネットワークから得た折れ線。2点に満たないときは線を描かない。 */
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
  /** 折れ線を実線で描くか。2点に満たない折れ線では線を引かない。 */
  readonly hasLine: boolean;
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
  evaluate<R>(
    pageFunction: (input: PrintMapRenderInput) => Promise<R>,
    input: PrintMapRenderInput,
  ): Promise<R>;
  evaluate<R>(
    pageFunction: (input: PrintMapLibrarySources) => Promise<R>,
    input: PrintMapLibrarySources,
  ): Promise<R>;
}

/** ページへ読み込む地図ライブラリの配布物。workerは本体とは別のファイルである。 */
export interface PrintMapLibrarySources {
  readonly library: string;
  readonly worker: string;
}

export interface PrintMapRenderInput {
  styleUrl: string;
  drawings: readonly PrintMapDrawing[];
  timeoutMs: number;
  linePaint: Readonly<Record<string, unknown>>;
  icons: Readonly<Record<PrintMapEndpointKind, string>>;
}

export function escapePrintMapHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * 描く折れ線を返す。折れ線が無ければ空を返し、線を引かない。
 */
export function printMapPath(leg: PrintMapLeg): readonly LngLat[] {
  return leg.path ?? [];
}

/** 折れ線を実線で描くか。2点に満たない折れ線は地図に引ける道を持たない。 */
export function hasPrintMapLine(path: readonly LngLat[]): boolean {
  return path.length >= 2;
}

/**
 * 地図に写す範囲を返す。折れ線と両端の地点のすべてを含め、東西・南北の
 * 幅が最小の広がりを下回るときは中心を保ったまま広げる。
 */
export function printMapBounds(leg: PrintMapLeg): PrintMapBounds {
  const points: LngLat[] = [
    ...printMapPath(leg),
    leg.start.position,
    leg.end.position,
  ];
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const [lng, lat] of points) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  if (!Number.isFinite(west)) {
    return { west: 0, south: 0, east: 0, north: 0 };
  }
  const centerLat = (south + north) / 2;
  const centerLng = (west + east) / 2;
  const minimumLatitudeSpan = PRINT_MAP_MIN_SPAN_METERS / METERS_PER_DEGREE;
  const minimumLongitudeSpan =
    PRINT_MAP_MIN_SPAN_METERS /
    (METERS_PER_DEGREE * Math.cos((centerLat * Math.PI) / 180));
  return {
    west:
      east - west >= minimumLongitudeSpan
        ? west
        : centerLng - minimumLongitudeSpan / 2,
    east:
      east - west >= minimumLongitudeSpan
        ? east
        : centerLng + minimumLongitudeSpan / 2,
    south:
      north - south >= minimumLatitudeSpan
        ? south
        : centerLat - minimumLatitudeSpan / 2,
    north:
      north - south >= minimumLatitudeSpan
        ? north
        : centerLat + minimumLatitudeSpan / 2,
  };
}

export function buildPrintMapDrawing(leg: PrintMapLeg): PrintMapDrawing {
  const path = printMapPath(leg);
  return {
    id: leg.id,
    bounds: printMapBounds(leg),
    path,
    start: leg.start,
    end: leg.end,
    hasLine: hasPrintMapLine(path),
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
  .print-map-marker { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 9999px; background-color: #111111; color: #ffffff; border: 2px solid #111111; box-sizing: border-box; }
  .print-map-marker[data-kind="place"] { width: 30px; height: 30px; background-color: #ffffff; color: #111111; border-width: 3px; }
  .print-map-marker svg { display: block; width: 16px; height: 16px; }
`;

/**
 * ページへ地図ライブラリを読み込む。この関数はpage.evaluateへ渡すため、
 * 外部の変数を参照せず、引数だけで完結させる。
 *
 * MapLibre 6はESMだけを配布し、classicのバンドルを持たない。scriptタグでは
 * 読み込めないため、配布物をBlobにしてimportする。workerはimport.meta.url
 * からの相対解決に頼れないので、同じ方法で作ったURLを明示的に渡す。
 */
async function loadPrintMapLibraryInPage(
  sources: PrintMapLibrarySources,
): Promise<void> {
  const api: {
    setWorkerUrl(url: string): void;
  } = await import(
    URL.createObjectURL(
      new Blob([sources.library], { type: "text/javascript" }),
    )
  );
  api.setWorkerUrl(
    URL.createObjectURL(new Blob([sources.worker], { type: "text/javascript" })),
  );
  (window as unknown as { maplibregl: unknown }).maplibregl = api;
}

/**
 * ページの中で地図を描く。この関数はpage.evaluateへ渡すため、
 * 外部の変数を参照せず、引数だけで完結させる。
 */
async function renderPrintMapsInPage(
  input: PrintMapRenderInput,
): Promise<{
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
              canvasContextAttributes: { preserveDrawingBuffer: true },
            });
          } catch (error) {
            window.clearTimeout(timer);
            settle(error instanceof Error ? error.message : "map-failed");
            return;
          }

          map.on("load", () => {
            if (!drawing.hasLine) {
              return;
            }
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

          const endpoints = [drawing.start, drawing.end].sort(
            (first, second) => Number(first.kind === "stop") - Number(second.kind === "stop"),
          );
          for (const endpoint of endpoints) {
            const element = document.createElement("div");
            element.className = "print-map-marker";
            element.dataset.kind = endpoint.kind;
            element.innerHTML = input.icons[endpoint.kind];
            new mapApi.Marker({ element, anchor: "center" })
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
    const [library, worker] = await Promise.all([
      readFile(`${process.cwd()}/${MAP_WORKER_SCRIPT}`, "utf8"),
      readFile(`${process.cwd()}/${MAP_WORKER_THREAD}`, "utf8"),
    ]);
    await page.evaluate(loadPrintMapLibraryInPage, { library, worker });
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
      icons: PRINT_MAP_MARKER_ICONS,
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
