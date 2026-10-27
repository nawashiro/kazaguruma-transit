import { Fragment } from "react";
import type { RouteDetailInfo, RouteDisplayStop } from "@/lib/transit/route-result-model";
import { generateGoogleMapDirectionLink, generateGoogleMapPointLink } from "@/utils/maps";
import StopTimeDisplay from "./StopTimeDisplay";
import { calculateArrivalTime } from "@/lib/transit/route-display-model";
import { calculateWalkingTimeMinutes } from "@/lib/transit/walking";
import { TRANSIT_PARAMS } from "@/lib/transit/transit-params";

interface IntegratedRouteDisplayProps {
  originStop: RouteDisplayStop;
  destinationStop: RouteDisplayStop;
  routes: RouteDetailInfo[];
  type: "direct" | "transfer" | "none";
  originLat?: number;
  originLng?: number;
  destLat?: number;
  destLng?: number;
}

function toMinutes(time: string): number | undefined {
  const match = time.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return undefined;
  return Number(match[1]) * 60 + Number(match[2]);
}

function shiftTime(time: string, minutes: number): string {
  const base = toMinutes(time);
  if (base === undefined) return "時刻不明";
  const total = base + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatTime(time: string): string {
  const base = toMinutes(time);
  if (base === undefined) return time;
  return `${Math.floor(base / 60)}時${base % 60}分`;
}

function walkMinutes(stop: RouteDisplayStop): number {
  return Math.ceil(calculateWalkingTimeMinutes(stop.distance, TRANSIT_PARAMS.WALKING_SPEED_KM_H)) + 5;
}

function AccentEdge() {
  return <hr className="bg-accent" />;
}

function SecondaryEdge() {
  return <hr className="bg-secondary" />;
}

function BusNode() {
  return <div className="timeline-middle w-4">
    <span className="block size-4 rounded-full border-2 shadow-sm border-secondary-content bg-secondary"></span>
  </div>;
}

function WalkNode() {
  return <div className="timeline-middle w-4">
    <span className="block size-4 rounded-full border-2 shadow-sm border-accent-content bg-accent"></span>
  </div>;
}

function RouteName({ routeName }: { routeName: string }) {
  return <p className="py-1 font-bold text-secondary-content dark:text-secondary">{routeName}</p>;
}

function TransferLabel() {
  return <p className="py-1">ここで乗り換え</p>;
}

function WalkLink({ href }: { href: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="link">徒歩で移動(Googleマップ)</a>;
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
  const originPoint = originLat && originLng ? generateGoogleMapPointLink(originLat, originLng) : undefined;
  const destinationPoint = destLat && destLng ? generateGoogleMapPointLink(destLat, destLng) : undefined;

  const firstRoute = routes[0];
  const lastArrivalTime = firstRoute?.transfers?.length
    ? firstRoute.transfers[firstRoute.transfers.length - 1].nextRoute.arrivalTime
    : firstRoute?.arrivalTime;
  const originDeparture = firstRoute?.departureTime && originMap
    ? shiftTime(firstRoute.departureTime, -walkMinutes(originStop)) : undefined;
  const destinationArrival = lastArrivalTime && destinationMap
    ? shiftTime(lastArrivalTime, walkMinutes(destinationStop)) : undefined;

  return <section className="min-w-0 space-y-4 break-words text-base">
    <ol className="timeline timeline-vertical timeline-compact">
      {originPoint && originDeparture && <li>
        <WalkNode />
        <div className="timeline-end min-w-0 w-full">
          <StopTimeDisplay stopName="出発地" href={originPoint} time={formatTime(originDeparture)} dateTime={originDeparture} />
        </div>
        <AccentEdge />
      </li>}
      {originMap && <li>
        <AccentEdge />
        <div className="timeline-middle w-4"></div>
        <div className="timeline-end min-w-0 w-full">
          <WalkLink href={originMap} />
        </div>
        <AccentEdge />
      </li>}
      {routes.map((route) => {
        const departure = route.departureTime || "時刻不明";
        const arrival = route.arrivalTime || calculateArrivalTime(departure, type === "direct" ? 45 : 30);
        const transfer = route.transfers?.[0];
        const transferDeparture = transfer?.nextRoute.departureTime || calculateArrivalTime(arrival, 15);
        const transferArrival = transfer?.nextRoute.arrivalTime || calculateArrivalTime(calculateArrivalTime(arrival, 15), 30);
        const afterRideEdge = (transfer || destinationMap) ? <AccentEdge /> : null;
        return <Fragment key={route.routeId}>
          <li>
            {originMap ? <AccentEdge /> : null}
            <BusNode />
            <div className="timeline-end min-w-0 w-full">
              <StopTimeDisplay stopName={originStop.stopName} time={formatTime(departure)} dateTime={departure} />
            </div>
            <SecondaryEdge />
          </li>
          <li>
            <SecondaryEdge />
            <div className="timeline-middle w-4"></div>
            <div className="timeline-end min-w-0 w-full">
              <RouteName routeName={route.routeName} />
            </div>
            <SecondaryEdge />
          </li>
          <li>
            <SecondaryEdge />
            <BusNode />
            <div className="timeline-end min-w-0 w-full">
              <StopTimeDisplay stopName={transfer?.transferStop.stopName ?? destinationStop.stopName} time={formatTime(arrival)} dateTime={arrival} />
            </div>
            {afterRideEdge}
          </li>
          {transfer && <Fragment key={transfer.transferStop.stopId}>
            <li>
              <AccentEdge />
              <div className="timeline-middle w-4"></div>
              <div className="timeline-end min-w-0 w-full">
                <TransferLabel />
              </div>
              <AccentEdge />
            </li>
            <li>
              <AccentEdge />
              <BusNode />
              <div className="timeline-end min-w-0 w-full">
                <StopTimeDisplay stopName={transfer.transferStop.stopName} time={formatTime(transferDeparture)} dateTime={transferDeparture} />
              </div>
              <SecondaryEdge />
            </li>
            <li>
              <SecondaryEdge />
              <div className="timeline-middle w-4"></div>
              <div className="timeline-end min-w-0 w-full">
                <RouteName routeName={transfer.nextRoute.routeName} />
              </div>
              <SecondaryEdge />
            </li>
            <li>
              <SecondaryEdge />
              <BusNode />
              <div className="timeline-end min-w-0 w-full">
                <StopTimeDisplay stopName={destinationStop.stopName} time={formatTime(transferArrival)} dateTime={transferArrival} />
              </div>
              {destinationMap ? <AccentEdge /> : null}
            </li>
          </Fragment>}
        </Fragment>;
      })}
      {destinationMap && <li>
        <AccentEdge />
        <div className="timeline-middle w-4"></div>
        <div className="timeline-end min-w-0 w-full">
          <WalkLink href={destinationMap} />
        </div>
        <AccentEdge />
      </li>}
      {destinationPoint && destinationArrival && <li>
        <AccentEdge />
        <WalkNode />
        <div className="timeline-end min-w-0 w-full">
          <StopTimeDisplay stopName="目的地" href={destinationPoint} time={formatTime(destinationArrival)} dateTime={destinationArrival} />
        </div>
      </li>}
    </ol>
  </section>;
}
