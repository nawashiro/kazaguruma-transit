"use client";

import React from "react";
import { Stop, Location } from "../types/transit";

interface TransitStopInfoProps {
  stopInfo: {
    stop_id: string;
    stop_name: string;
    distance?: number;
  };
  location: Location;
  type: "origin" | "destination";
}

const TransitStopInfo: React.FC<TransitStopInfoProps> = ({
  stopInfo,
  location,
  type,
}) => {
  const isOrigin = type === "origin";
  const title = isOrigin ? "出発バス停" : "目的地バス停";

  // 距離が600m以上かどうかをチェック
  const isTooFar = stopInfo.distance && stopInfo.distance > 0.6;

  // 距離をメートル単位に変換（kmから1000を掛ける）
  const distanceInMeters = stopInfo.distance
    ? Math.round(stopInfo.distance * 1000)
    : undefined;

  return (
    <div className="bg-base-100 p-3 rounded-lg shadow-sm mt-3 border border-base-300">
      <h3 className="text-md font-bold">
        {title}: {stopInfo.stop_name}
      </h3>

      {distanceInMeters !== undefined && (
        <p className="text-xs mt-1">
          {isOrigin ? "出発地" : "目的地"}からの距離: 約 {distanceInMeters} m
        </p>
      )}

      {isTooFar && (
        <div className="alert alert-warning text-xs mt-2 p-2 flex items-start">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-4 w-4 mt-0.5"
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
          <span className="ml-1">
            {isOrigin ? "出発地" : "目的地"}からバス停まで{" "}
            {distanceInMeters ? distanceInMeters : "不明"} m 離れています
            （徒歩約{" "}
            {distanceInMeters ? Math.round(distanceInMeters / 80) : "不明"} 分）
          </span>
        </div>
      )}
    </div>
  );
};

export default TransitStopInfo;
