import type { Departure } from "@/types/core";
import type { RouteDetailInfo, RouteDisplayStop } from "@/lib/transit/route-result-model";
import { generateGoogleMapDirectionLink } from "@/utils/maps";
import StopTimeDisplay from "./StopTimeDisplay";
import { calculateArrivalTime } from "@/lib/transit/route-display-model";

interface IntegratedRouteDisplayProps {
  originStop: RouteDisplayStop;
  destinationStop: RouteDisplayStop;
  routes: RouteDetailInfo[];
  type: "direct" | "transfer" | "none";
  _transfers?: number;
  departures?: Departure[];
  _message?: string;
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
}

function formatTime(time: string): string {
  const match = time.match(/^(\d{2}):(\d{2}):\d{2}$/);
  return match ? `${match[1]}時${match[2]}分` : time;
}

function Segment({ routeName, from, to, departure, arrival }: {
  routeName: string; from: string; to: string; departure: string; arrival: string;
}) {
  return <>
    <h3 className="mb-3 text-lg font-bold">{routeName}</h3>
    <ol className="space-y-3">
      <li><StopTimeDisplay stopName={from} time={formatTime(departure)} dateTime={departure} /></li>
      <li><StopTimeDisplay stopName={to} time={formatTime(arrival)} dateTime={arrival} /></li>
    </ol>
  </>;
}

export default function IntegratedRouteDisplay({
  originStop, destinationStop, routes, type, originLat, originLng, destLat, destLng,
}: IntegratedRouteDisplayProps) {
  if (type === "none") return <section className="text-base">
    <h2 className="mb-2 text-xl font-bold">ルートが見つかりません</h2>
    <p>この2つの地点を結ぶルートが見つかりませんでした</p>
    <p className="mt-2">別の交通手段をご検討ください</p>
  </section>;

  const originStopLat = originStop.stop_lat || originStop.lat || 0;
  const originStopLng = originStop.stop_lon || originStop.lng || 0;
  const destinationStopLat = destinationStop.stop_lat || destinationStop.lat || 0;
  const destinationStopLng = destinationStop.stop_lon || destinationStop.lng || 0;
  const originMap = originLat && originLng && originStopLat && originStopLng
    ? generateGoogleMapDirectionLink(originLat, originLng, originStopLat, originStopLng) : undefined;
  const destinationMap = destLat && destLng && destinationStopLat && destinationStopLng
    ? generateGoogleMapDirectionLink(destinationStopLat, destinationStopLng, destLat, destLng) : undefined;

  return <section className="min-w-0 space-y-4 break-words text-base">
    <h2 className="text-xl font-bold">経路</h2>
    {originMap && <a href={originMap} target="_blank" rel="noopener noreferrer" className="link block text-base">出発地 → {originStop.stopName} Googleマップ</a>}
    <ul className="space-y-6">
      {routes.map((route) => {
        const departure = route.departureTime || "時刻不明";
        const arrival = route.arrivalTime || calculateArrivalTime(departure, type === "direct" ? 45 : 30);
        return <li key={route.routeId} className="space-y-4">
          <Segment routeName={route.routeName} from={originStop.stopName} to={route.transfers?.[0]?.transferStop.stopName ?? destinationStop.stopName} departure={departure} arrival={arrival} />
          {route.transfers?.map((transfer) => {
            const transferDeparture = transfer.nextRoute.departureTime || calculateArrivalTime(arrival, 15);
            const transferArrival = transfer.nextRoute.arrivalTime || calculateArrivalTime(calculateArrivalTime(arrival, 15), 30);
            return <div key={transfer.transferStop.stopId} className="space-y-4">
              <hr />
              <p className="font-bold">ここで乗り換え</p>
              <Segment routeName={transfer.nextRoute.routeName} from={transfer.transferStop.stopName} to={destinationStop.stopName} departure={transferDeparture} arrival={transferArrival} />
            </div>;
          })}
        </li>;
      })}
    </ul>
    {destinationMap && <a href={destinationMap} target="_blank" rel="noopener noreferrer" className="link block text-base">{destinationStop.stopName} → 目的地 Googleマップ</a>}
  </section>;
}
