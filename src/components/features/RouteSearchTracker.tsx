"use client";

import { useEffect } from "react";
import { takeSearchStart, track } from "@/lib/analytics/tracking";

export default function RouteSearchTracker() {
  useEffect(() => {
    const startedAt = takeSearchStart();
    if (startedAt === null) return;
    track("route_search", { elapsed_ms: Math.max(0, Date.now() - startedAt) });
  }, []);

  return null;
}
