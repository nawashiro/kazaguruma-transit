"use client";

import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import RoutePdfExport from "./RoutePdfExport";
import RouteCalendarExport from "./RouteCalendarExport";
import type { RouteMemoState } from "./RouteResultDiscussion";
import { isDiscussionsEnabled } from "@/lib/config/discussion-config";
import type { RouteResultViewModel } from "@/lib/transit/route-result-model";
import type { RouteSearchQuery } from "@/lib/transit/route-search-query";
import type { PostWithStats } from "@/types/discussion";
import { logger } from "@/utils/logger";

const RouteResultDiscussion = lazy(() => import("./RouteResultDiscussion"));

class DiscussionErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    logger.error("停留所のメモ・掲示板表示エラー:", error);
  }

  render() {
    return this.state.failed
      ? <p role="status">停留所のメモ・掲示板を表示できません</p>
      : this.props.children;
  }
}

interface RouteResultActionsProps {
  routeInfo: RouteResultViewModel;
  query: RouteSearchQuery;
}

export default function RouteResultActions({ routeInfo, query }: RouteResultActionsProps) {
  const discussionsEnabled = isDiscussionsEnabled();
  const busStops = useMemo(() => [...new Set([
    routeInfo.originStop.stopName,
    routeInfo.destinationStop.stopName,
    ...routeInfo.routes.flatMap((route) => (route.transfers ?? []).map((transfer) => transfer.transferStop.stopName)),
  ])], [routeInfo]);
  const [memoState, setMemoState] = useState<RouteMemoState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const memoData = discussionsEnabled && memoState?.busStops === busStops ? memoState.data : new Map<string, PostWithStats>();
  const exportProps = {
    originStop: routeInfo.originStop,
    destinationStop: routeInfo.destinationStop,
    routes: routeInfo.routes,
    selectedDateTime: query.time,
    originLat: query.origin.lat,
    originLng: query.origin.lng,
    destLat: query.destination.lat,
    destLng: query.destination.lng,
  };

  return <>
    <div className="flex flex-col items-start gap-4">
      <RouteCalendarExport {...exportProps} />
      <RoutePdfExport {...exportProps} type={routeInfo.type} transfers={routeInfo.transfers} memoData={memoData} />
    </div>
    {mounted && discussionsEnabled && <DiscussionErrorBoundary key={JSON.stringify(busStops)}>
      <Suspense fallback={null}>
        <RouteResultDiscussion busStops={busStops} onMemoData={setMemoState} />
      </Suspense>
    </DiscussionErrorBoundary>}
  </>;
}
