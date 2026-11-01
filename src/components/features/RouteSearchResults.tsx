import IntegratedRouteDisplay from "./IntegratedRouteDisplay";
import RouteResultActions from "./RouteResultActions";
import type { RouteSearchResult } from "@/lib/transit/search-routes";

interface RouteSearchResultsProps {
  result: Exclude<RouteSearchResult, { status: "limited" }>;
}

export default function RouteSearchResults({ result }: RouteSearchResultsProps) {
  return (
    <div className="flex min-w-0 flex-col gap-4 text-base break-words">
      {result.status === "error" ? (
        <div role="alert" className="alert alert-error alert-soft text-base-content!">
          <p>{result.message}</p>
        </div>
      ) : <>
        <IntegratedRouteDisplay
          originStop={result.routeInfo.originStop}
          destinationStop={result.routeInfo.destinationStop}
          routes={result.routeInfo.routes}
          type={result.routeInfo.type}
          originLat={result.query.origin.lat}
          originLng={result.query.origin.lng}
          destLat={result.query.destination.lat}
          destLng={result.query.destination.lng}
        />
        {result.routeInfo.type !== "none" && <RouteResultActions routeInfo={result.routeInfo} query={result.query} />}
      </>}
    </div>
  );
}
