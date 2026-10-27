"use client";

import { useEffect } from "react";
import { BusStopDiscussion, BusStopMemo, getBusStopMemoData } from "@/components/discussion";
import type { PostWithStats } from "@/types/discussion";
import { logger } from "@/utils/logger";

export interface RouteMemoState {
  busStops: string[];
  data: Map<string, PostWithStats>;
}

interface RouteResultDiscussionProps {
  busStops: string[];
  onMemoData: (state: RouteMemoState) => void;
}

export default function RouteResultDiscussion({ busStops, onMemoData }: RouteResultDiscussionProps) {
  useEffect(() => {
    let active = true;
    async function loadMemos() {
      try {
        const data = await getBusStopMemoData(busStops);
        if (active) onMemoData({ busStops, data });
      } catch (error: unknown) {
        logger.error("停留所メモ取得エラー:", error);
      }
    }
    void loadMemos();
    return () => { active = false; };
  }, [busStops, onMemoData]);

  return <>
    <div className="mt-4"><BusStopMemo busStops={busStops} /></div>
    <div className="mt-4"><BusStopDiscussion busStops={busStops} className="border-t border-gray-200 dark:border-gray-700 pt-8" /></div>
  </>;
}
