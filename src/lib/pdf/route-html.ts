import { calculateArrivalTime } from "../transit/route-display-model";
import {
  PRINT_MAP_CSS,
  buildPrintMapHtml,
  type PrintMapLeg,
} from "./print-map";

export interface NextRouteInfo {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  departureTime?: string;
  arrivalTime?: string;
  stopCount?: number;
}

export interface GeneratePdfRequest {
  originStop: {
    stopId: string;
    stopName: string;
    distance: number;
    stop_lat?: number;
    stop_lon?: number;
    lat?: number;
    lng?: number;
  };
  destinationStop: {
    stopId: string;
    stopName: string;
    distance: number;
    stop_lat?: number;
    stop_lon?: number;
    lat?: number;
    lng?: number;
  };
  routes: Array<{
    routeId: string;
    routeName: string;
    routeShortName: string;
    routeLongName: string;
    routeColor: string;
    routeTextColor: string;
    departureTime?: string;
    arrivalTime?: string;
    stopCount?: number;
    transfers?: Array<{
      transferStop: {
        stopId: string;
        stopName: string;
        stopLat: number;
        stopLon: number;
      };
      nextRoute: NextRouteInfo;
    }>;
  }>;
  type: "direct" | "transfer" | "none";
  transfers: number;
  departures?: Array<{
    route_id: string;
    trip_id: string;
    departure_time: string;
    stop_id: string;
    stop_name: string;
    sequence: number;
  }>;
  message?: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
  selectedDateTime?: string;
  /** 徒歩区間の折れ線。道の上の座標だけを渡し、2点に満たないときは線を描かない。 */
  walkPaths?: {
    originToStop?: Array<[number, number]>;
    stopToDestination?: Array<[number, number]>;
  };
  memoData?: Record<
    string,
    {
      id: string;
      content: string;
      busStopTag: string;
      evaluationStats: {
        positiveCount: number;
        negativeCount: number;
        score: number;
      };
    }
  >;
}

export async function generateRouteHTML(data: GeneratePdfRequest): Promise<string> {
  const today = new Date();

  const dateToUse = data.selectedDateTime
    ? new Date(data.selectedDateTime)
    : today;

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const weekday = weekdays[dateToUse.getDay()];

  const formattedDate = `${dateToUse.getFullYear()}年${
    dateToUse.getMonth() + 1
  }月${dateToUse.getDate()}日(${weekday})`;

  const getDepartureTime = (stopId: string, routeId?: string) => {
    return (
      data.routes.find((r) => r.routeId === routeId)?.departureTime ||
      "時刻不明"
    );
  };

  const formatTimeDisplay = (time: string) => {
    if (time === "時刻不明") return time;
    const match = time.match(/^(\d{2}):(\d{2}):\d{2}$/);
    return match ? `${match[1]}時${match[2]}分` : time;
  };

  const getMemoForStop = (stopName: string): string => {
    if (!data.memoData) return "";

    for (const [busStopName, memo] of Object.entries(data.memoData)) {
      if (busStopName === stopName) {
        return `<div class="text-sm text-gray-600 mt-1" style="color: #6b7280; font-size: 0.875rem; margin-top: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${memo.content}</div>`;
      }
    }
    return "";
  };

  if (data.type === "none") {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>乗換案内</title>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Noto Sans JP', sans-serif; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; }
            .text-center { text-align: center; }
            .space-y-4 > * + * { margin-top: 1rem; }
            .text-lg { font-size: 1.125rem; }
            .text-xl { font-size: 1.25rem; }
            .font-bold { font-weight: bold; }
            .text-xs { font-size: 0.75rem; }
            .mx-auto { margin-left: auto; margin-right: auto; }
            .w-24 { width: 6rem; height: 6rem; }
          </style>
        </head>
        <body>
          <div class="container space-y-4">
            <div class="text-center">
              <p class="text-lg">${formattedDate}</p>
            </div>
            <div class="text-center space-y-4">
              <h3 class="text-xl font-bold">ルートが見つかりません</h3>
              <p>この2つの地点を結ぶルートが見つかりませんでした</p>
              <p>別の交通手段をご検討ください</p>
            </div>
            <div class="text-center text-xs space-y-2">
              <p><a href="https://kazaguruma.bus-go.com/sp/sp-busgo.php">最新の運行情報はこちら【千代田区公式】</a></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  let routesHtml = "";

  data.routes.forEach((route) => {
    const departureTime =
      route.departureTime ||
      getDepartureTime(data.originStop.stopId, route.routeId || "");
    const firstSegmentDuration = data.type === "direct" ? 45 : 30;
    const arrivalTime =
      route.arrivalTime || calculateArrivalTime(departureTime, firstSegmentDuration);

    const hasTransfers = route.transfers && route.transfers.length > 0;
    const destinationName =
      hasTransfers && route.transfers?.[0]
        ? route.transfers[0].transferStop.stopName
        : data.destinationStop.stopName;

    routesHtml += `
      <div class="card bg-white p-4 border-left-4 my-4" style="border-left: 4px solid #ccc;">
        <div class="flex justify-between items-center mb-2">
          <div class="flex">
            <div class="text-lg font-bold mr-2">${
              data.originStop.stopName
            }</div>
            ${getMemoForStop(data.originStop.stopName)}
          </div>
          <div class="badge" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
            ${formatTimeDisplay(departureTime)}
          </div>
        </div>
        
        <div class="flex items-center my-3">
          <div class="badge mr-2" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
            ${route.routeName}
          </div>
        </div>
        
        <div class="flex justify-between items-center">
          <div class="flex">
            <div class="text-lg font-bold mr-2">${destinationName}</div>
            ${getMemoForStop(destinationName)}
          </div>
          <div class="badge" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
            ${formatTimeDisplay(arrivalTime)}
          </div>
        </div>
      </div>
    `;

    if (hasTransfers && route.transfers) {
      routesHtml += `
        <div class="text-center my-4">
          <div style="display: inline-block; background-color: #f3f4f6; padding: 0.5rem 1rem; border-radius: 9999px; font-weight: bold; color: #4b5563; border: 1px solid #d1d5db; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
            ここで乗り換え
          </div>
        </div>
      `;

      route.transfers.forEach((transfer) => {
        const transferWaitTime = 15;
        const transferDepartureTime = calculateArrivalTime(
          arrivalTime,
          transferWaitTime
        );
        const finalArrivalTime = calculateArrivalTime(transferDepartureTime, 30);

        routesHtml += `
          <div class="card bg-white p-4 border-left-4 my-4" style="border-left: 4px solid #ccc;">
            <div class="flex justify-between items-center mb-2">
              <div class="flex">
                <div class="text-lg font-bold mr-2">${
                  transfer.transferStop.stopName
                }</div>
                ${getMemoForStop(transfer.transferStop.stopName)}
              </div>
              <div class="badge" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
                ${formatTimeDisplay(
                  transfer.nextRoute.departureTime || transferDepartureTime
                )}
              </div>
            </div>
            
            <div class="flex items-center my-3">
              <div class="badge mr-2" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
                ${transfer.nextRoute.routeName}
              </div>
            </div>
            
            <div class="flex justify-between items-center">
              <div class="flex">
                <div class="text-lg font-bold mr-2">${
                  data.destinationStop.stopName
                }</div>
                ${getMemoForStop(data.destinationStop.stopName)}
              </div>
              <div class="badge" style="border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.25rem 0.5rem;">
                ${formatTimeDisplay(
                  transfer.nextRoute.arrivalTime || finalArrivalTime
                )}
              </div>
            </div>
          </div>
        `;
      });
    }
  });

  const printMapLegs = collectPrintMapLegs(data);
  const originLeg = printMapLegs.find((leg) => leg.id === "origin");
  const destinationLeg = printMapLegs.find((leg) => leg.id === "destination");

  const originToStopMapHtml =
    originLeg === undefined
      ? ""
      : `
      <div class="map-container" style="max-width: 600px; margin: 0 auto; margin-bottom: 1rem;">
        ${buildPrintMapHtml(originLeg)}
      </div>
    `;

  const stopToDestMapHtml =
    destinationLeg === undefined
      ? ""
      : `
      <div class="map-container" style="max-width: 600px; margin: 0 auto; margin-top: 1rem;">
        ${buildPrintMapHtml(destinationLeg)}
      </div>
    `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>乗換案内</title>
        <meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Noto Sans JP', sans-serif; padding: 0; margin: 0; }
          .container { max-width: 800px; margin: 0 auto; padding: 0 24px; }
          .text-center { text-align: center; }
          .space-y-4 > * + * { margin-top: 1rem; }
          .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
          .text-lg { font-size: 1.125rem; }
          .text-xl { font-size: 1.25rem; }
          .font-bold { font-weight: bold; }
          .text-xs { font-size: 0.75rem; }
          .mx-auto { margin-left: auto; margin-right: auto; }
          .w-24 { width: 6rem; height: 6rem; }
          .flex { display: flex; }
          .items-center { align-items: center; }
          .justify-between { justify-content: space-between; }
          .mr-2 { margin-right: 0.5rem; }
          .mb-2 { margin-bottom: 0.5rem; }
          .ml-2 { margin-left: 0.5rem; }
          .my-3 { margin-top: 0.75rem; margin-bottom: 0.75rem; }
          .p-4 { padding: 1rem; }
          .card { background-color: #fff; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06); }
          .badge { display: inline-block; }
          .p-3 { padding: 0.75rem; }
          .text-gray-500 { color: #6b7280; }
          .bg-white { background-color: white; }
          ${PRINT_MAP_CSS}
        </style>
      </head>
      <body>
        <div class="container space-y-4 bg-white">
          <div class="text-center">
            <p class="text-lg">${formattedDate}</p>
          </div>
          
          ${originToStopMapHtml}
          
          ${routesHtml}
          
          ${stopToDestMapHtml}
          
        </div>
      </body>
    </html>
  `;
}

export function collectPrintMapLegs(data: GeneratePdfRequest): PrintMapLeg[] {
  const legs: PrintMapLeg[] = [];
  if (data.type === "none") {
    return legs;
  }
  const originStopLat = data.originStop.stop_lat ?? data.originStop.lat;
  const originStopLng = data.originStop.stop_lon ?? data.originStop.lng;
  if (
    data.originLat !== undefined &&
    data.originLng !== undefined &&
    originStopLat !== undefined &&
    originStopLng !== undefined
  ) {
    legs.push({
      id: "origin",
      start: {
        label: "出発地",
        position: [data.originLng, data.originLat],
        kind: "place",
      },
      end: {
        label: data.originStop.stopName,
        position: [Number(originStopLng), Number(originStopLat)],
        kind: "stop",
      },
      path: data.walkPaths?.originToStop,
    });
  }

  const destinationStopLat =
    data.destinationStop.stop_lat ?? data.destinationStop.lat;
  const destinationStopLng =
    data.destinationStop.stop_lon ?? data.destinationStop.lng;
  if (
    data.destLat !== undefined &&
    data.destLng !== undefined &&
    destinationStopLat !== undefined &&
    destinationStopLng !== undefined
  ) {
    legs.push({
      id: "destination",
      start: {
        label: data.destinationStop.stopName,
        position: [Number(destinationStopLng), Number(destinationStopLat)],
        kind: "stop",
      },
      end: { label: "目的地", position: [data.destLng, data.destLat], kind: "place" },
      path: data.walkPaths?.stopToDestination,
    });
  }
  return legs;
}
