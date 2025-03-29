import React from "react";

// ルート情報の型定義
interface RouteDetail {
  routeId: string;
  routeName: string;
  routeShortName: string;
  routeLongName: string;
  routeColor: string;
  routeTextColor: string;
  transfers?: TransferInfo[];
}

// 乗り換え情報の型定義
interface TransferInfo {
  transferStop: {
    stopId: string;
    stopName: string;
    stopLat: number;
    stopLon: number;
  };
  nextRoute: RouteDetail;
}

// バス停情報の型定義
interface StopInfo {
  stopId: string;
  stopName: string;
  distance: number;
}

// コンポーネントのプロパティ型定義
interface RouteDetailProps {
  originStop: StopInfo;
  destinationStop: StopInfo;
  routes: RouteDetail[];
  type: "direct" | "transfer" | "none";
  transfers: number;
  message?: string;
}

const RouteDetail: React.FC<RouteDetailProps> = ({
  originStop,
  destinationStop,
  routes,
  type,
  transfers,
  message,
}) => {
  if (type === "none" || routes.length === 0) {
    return (
      <div className="card bg-base-100 shadow-xl mb-4">
        <div className="card-body">
          <h2 className="card-title text-xl font-bold text-error">
            ルートが見つかりません
          </h2>
          <p className="text-sm mb-4">
            {message || "この2つの地点を結ぶルートが見つかりませんでした"}
          </p>
          <div className="alert alert-warning">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>
              最寄りのバス停まで歩くか、別の交通手段を検討してください。
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (type === "direct") {
    return (
      <div className="card bg-base-100 shadow-xl mb-4">
        <div className="card-body">
          <h2 className="card-title text-xl font-bold text-success">
            直行ルートが見つかりました
          </h2>
          <p className="text-sm mb-4">
            <span className="font-bold">{originStop.stopName}</span> から{" "}
            <span className="font-bold">{destinationStop.stopName}</span> まで
            直接行けるバス路線があります
          </p>

          <div className="divider">利用可能なバス路線</div>

          <div className="routes-container">
            {routes.map((route) => (
              <div
                key={route.routeId}
                className="route-item flex items-center p-3 mb-2 rounded-lg"
                style={{
                  backgroundColor: route.routeColor
                    ? `#${route.routeColor}`
                    : "#f5f5f5",
                  color: route.routeTextColor
                    ? `#${route.routeTextColor}`
                    : "#000000",
                }}
              >
                <div
                  className="route-number font-bold text-lg mr-3 flex items-center justify-center rounded-full bg-white w-10 h-10"
                  style={{
                    color: route.routeColor
                      ? `#${route.routeColor}`
                      : "#000000",
                  }}
                >
                  {route.routeShortName || "?"}
                </div>
                <div className="route-details">
                  <div className="route-name font-medium">
                    {route.routeLongName || route.routeName}
                  </div>
                  <div className="text-xs opacity-80">
                    路線ID: {route.routeId}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex justify-between items-center">
            <div className="badge badge-outline p-3">乗換なし</div>
            <div className="text-sm text-gray-500">
              最寄りバス停までの距離: {(originStop.distance * 1000).toFixed(0)}m
              / {(destinationStop.distance * 1000).toFixed(0)}m
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 乗り換えが必要なルートの表示
  return (
    <div className="card bg-base-100 shadow-xl mb-4">
      <div className="card-body">
        <h2 className="card-title text-xl font-bold text-warning">
          乗換ルートが見つかりました
        </h2>
        <p className="text-sm mb-4">
          <span className="font-bold">{originStop.stopName}</span> から{" "}
          <span className="font-bold">{destinationStop.stopName}</span> まで
          {transfers}回の乗換で行けます
        </p>

        {routes.map((route, index) => (
          <div key={`route-${index}`} className="mb-4">
            <div className="divider">最初のルート</div>

            <div
              className="route-item flex items-center p-3 mb-2 rounded-lg"
              style={{
                backgroundColor: route.routeColor
                  ? `#${route.routeColor}`
                  : "#f5f5f5",
                color: route.routeTextColor
                  ? `#${route.routeTextColor}`
                  : "#000000",
              }}
            >
              <div
                className="route-number font-bold text-lg mr-3 flex items-center justify-center rounded-full bg-white w-10 h-10"
                style={{
                  color: route.routeColor ? `#${route.routeColor}` : "#000000",
                }}
              >
                {route.routeShortName || "?"}
              </div>
              <div className="route-details">
                <div className="route-name font-medium">
                  {route.routeLongName || route.routeName}
                </div>
                <div className="text-xs opacity-80">
                  ルート: {originStop.stopName} →{" "}
                  {route.transfers?.[0]?.transferStop?.stopName || "不明"}
                </div>
              </div>
            </div>

            {route.transfers &&
              route.transfers.map((transfer, tIndex) => (
                <div key={`transfer-${tIndex}`}>
                  <div className="transfer-point flex items-center py-2">
                    <div className="w-10 h-10 flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-warning"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <div className="font-bold">
                        乗換: {transfer.transferStop.stopName}
                      </div>
                      <div className="text-xs text-gray-500">
                        別のバスに乗り換えてください
                      </div>
                    </div>
                  </div>

                  <div className="divider">次のルート</div>

                  <div
                    className="route-item flex items-center p-3 mb-2 rounded-lg"
                    style={{
                      backgroundColor: transfer.nextRoute.routeColor
                        ? `#${transfer.nextRoute.routeColor}`
                        : "#f5f5f5",
                      color: transfer.nextRoute.routeTextColor
                        ? `#${transfer.nextRoute.routeTextColor}`
                        : "#000000",
                    }}
                  >
                    <div
                      className="route-number font-bold text-lg mr-3 flex items-center justify-center rounded-full bg-white w-10 h-10"
                      style={{
                        color: transfer.nextRoute.routeColor
                          ? `#${transfer.nextRoute.routeColor}`
                          : "#000000",
                      }}
                    >
                      {transfer.nextRoute.routeShortName || "?"}
                    </div>
                    <div className="route-details">
                      <div className="route-name font-medium">
                        {transfer.nextRoute.routeLongName ||
                          transfer.nextRoute.routeName}
                      </div>
                      <div className="text-xs opacity-80">
                        ルート: {transfer.transferStop.stopName} →{" "}
                        {destinationStop.stopName}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ))}

        <div className="mt-4 flex justify-between items-center">
          <div className="badge badge-warning p-3">乗換: {transfers}回</div>
          <div className="text-sm text-gray-500">
            最寄りバス停までの距離: {(originStop.distance * 1000).toFixed(0)}m /{" "}
            {(destinationStop.distance * 1000).toFixed(0)}m
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteDetail;
