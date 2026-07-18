"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import IntegratedRouteDisplay from "./IntegratedRouteDisplay";
import RoutePdfExport from "./RoutePdfExport";
import RouteCalendarExport from "./RouteCalendarExport";
import RateLimitModal from "./RateLimitModal";
import { BusStopDiscussion, BusStopMemo, getBusStopMemoData } from "@/components/discussion";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import {
  buildTransitApiUrl,
  parseRouteSearchParams,
} from "@/lib/transit/route-search-query";
import {
  createRouteResultViewModel,
  type RouteResultData,
  type RouteResultViewModel,
} from "@/lib/transit/route-result-model";
import type { PostWithStats } from "@/types/discussion";
import { logger } from "@/utils/logger";

interface ApiResponse {
  success: boolean;
  data?: RouteResultData;
  error?: string;
  limitExceeded?: boolean;
}

type ResultState =
  | { status: "loading" }
  | { status: "success"; routeInfo: RouteResultViewModel }
  | { status: "error"; message: string };

interface RouteSearchResultsProps {
  searchParams: string;
}

function getBusStops(routeInfo: RouteResultViewModel): string[] {
  if (routeInfo.type === "none") return [];

  const busStops = [routeInfo.originStop.stopName, routeInfo.destinationStop.stopName];
  for (const route of routeInfo.routes) {
    for (const transfer of route.transfers ?? []) {
      busStops.push(transfer.transferStop.stopName);
    }
  }
  return [...new Set(busStops)];
}

function SearchError({ message }: { message: string }) {
  return (
    <Card>
      <div role="alert" className="alert alert-error mb-4">
        {message}
      </div>
      <Link href="/" className="link ruby-text min-h-[44px] inline-flex items-center">
        検索条件を変更
      </Link>
    </Card>
  );
}

export default function RouteSearchResults({ searchParams }: RouteSearchResultsProps) {
  const parsed = useMemo(
    () => parseRouteSearchParams(new URLSearchParams(searchParams)),
    [searchParams],
  );
  const [resultState, setResultState] = useState<ResultState>({ status: "loading" });
  const [isRateLimitModalOpen, setIsRateLimitModalOpen] = useState(false);
  const [memoData, setMemoData] = useState<Map<string, PostWithStats>>(new Map());

  useEffect(() => {
    if (!parsed.isValid) return;

    const abortController = new AbortController();
    setResultState({ status: "loading" });
    setIsRateLimitModalOpen(false);

    const search = async () => {
      try {
        const response = await fetch(buildTransitApiUrl(parsed.query), {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: abortController.signal,
        });
        const apiResponse = (await response.json()) as ApiResponse;

        if (response.status === 429 && apiResponse.limitExceeded) {
          setIsRateLimitModalOpen(true);
          setResultState({ status: "error", message: "利用制限に達しました" });
          return;
        }
        if (!response.ok || !apiResponse.success) {
          setResultState({
            status: "error",
            message: apiResponse.error || "経路検索に失敗しました",
          });
          return;
        }

        setResultState({
          status: "success",
          routeInfo: createRouteResultViewModel(
            apiResponse.data,
            parsed.query.origin,
            parsed.query.destination,
          ),
        });
      } catch (error) {
        if (abortController.signal.aborted) return;
        logger.error("経路検索リクエストエラー:", error);
        setResultState({
          status: "error",
          message: error instanceof Error ? error.message : "予期せぬエラーが発生しました",
        });
      }
    };

    void search();
    return () => abortController.abort();
  }, [parsed]);

  useEffect(() => {
    if (
      resultState.status !== "success" ||
      resultState.routeInfo.type === "none" ||
      !isDiscussionsEnabled()
    ) {
      setMemoData(new Map());
      return;
    }

    void getBusStopMemoData(getBusStops(resultState.routeInfo)).then(setMemoData);
  }, [resultState]);

  if (!parsed.isValid) return <SearchError message={parsed.error} />;
  if (resultState.status === "loading") {
    return (
      <Card bodyClassName="items-center">
        <div role="status" className="flex flex-col items-center gap-2">
          <span className="loading loading-spinner loading-lg" aria-hidden="true" />
          <span className="ruby-text">経路を検索中...</span>
        </div>
      </Card>
    );
  }
  if (resultState.status === "error") {
    return (
      <>
        <SearchError message={resultState.message} />
        <RateLimitModal
          isOpen={isRateLimitModalOpen}
          onClose={() => setIsRateLimitModalOpen(false)}
        />
      </>
    );
  }

  const { routeInfo } = resultState;
  const busStops = getBusStops(routeInfo);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/" className="link ruby-text min-h-[44px] inline-flex items-center w-fit">
        検索条件を変更
      </Link>
      <IntegratedRouteDisplay
        originStop={routeInfo.originStop}
        destinationStop={routeInfo.destinationStop}
        routes={routeInfo.routes}
        type={routeInfo.type}
        _transfers={routeInfo.transfers}
        _message={routeInfo.message}
        originLat={parsed.query.origin.lat}
        originLng={parsed.query.origin.lng}
        destLat={parsed.query.destination.lat}
        destLng={parsed.query.destination.lng}
      />
      {routeInfo.type !== "none" && (
        <>
          <div className="flex flex-col items-center gap-4">
            <RouteCalendarExport
              originStop={routeInfo.originStop}
              destinationStop={routeInfo.destinationStop}
              routes={routeInfo.routes}
              selectedDateTime={parsed.query.time}
              originLat={parsed.query.origin.lat}
              originLng={parsed.query.origin.lng}
              destLat={parsed.query.destination.lat}
              destLng={parsed.query.destination.lng}
            />
            <RoutePdfExport
              originStop={routeInfo.originStop}
              destinationStop={routeInfo.destinationStop}
              routes={routeInfo.routes}
              type={routeInfo.type}
              transfers={routeInfo.transfers}
              originLat={parsed.query.origin.lat}
              originLng={parsed.query.origin.lng}
              destLat={parsed.query.destination.lat}
              destLng={parsed.query.destination.lng}
              selectedDateTime={parsed.query.time}
              memoData={memoData}
            />
          </div>
          {isDiscussionsEnabled() && (
            <>
              <div className="mt-4"><BusStopMemo busStops={busStops} /></div>
              <div className="mt-4">
                <BusStopDiscussion
                  busStops={busStops}
                  className="border-t border-gray-200 dark:border-gray-700 pt-8"
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
