"use client";

import ReactGA from "react-ga4";
import { appConfig } from "@/lib/config/app-config";
import { logger } from "@/utils/logger";

export type MeasurementParams = Record<string, string | number | boolean>;
export type PlaceField = "origin" | "destination";

export const OWNER_STORAGE_KEY = "kazaguruma.owner";
export const SEARCH_STARTED_KEY = "kazaguruma.searchStartedAt";

const OWNER_QUERY = "owner";

export function readOwnerFlag(): boolean {
  try {
    return window.localStorage.getItem(OWNER_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function syncOwnerFlag(): boolean {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get(OWNER_QUERY);
  if (raw === "1") writeOwnerFlag(true);
  if (raw === "0") writeOwnerFlag(false);
  if (raw !== null) {
    url.searchParams.delete(OWNER_QUERY);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  return readOwnerFlag();
}

export function ownerFields(): MeasurementParams {
  return readOwnerFlag()
    ? { traffic_type: "internal", user_type: "owner" }
    : {};
}

export function track(eventName: string, params: MeasurementParams = {}): void {
  if (process.env.NODE_ENV === "development") {
    logger.log(`[GA Event] ${eventName}`, params);
    return;
  }
  if (!appConfig.gaMeasurementId) return;
  ReactGA.event(eventName, { ...params, ...ownerFields() });
}

export function markSearchStart(now: number = Date.now()): void {
  try {
    window.sessionStorage.setItem(SEARCH_STARTED_KEY, String(now));
  } catch {
    // 保存できないブラウザでは計測を諦め、検索はそのまま続ける。
  }
}

export function takeSearchStart(): number | null {
  try {
    const raw = window.sessionStorage.getItem(SEARCH_STARTED_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(SEARCH_STARTED_KEY);
    const started = Number(raw);
    return Number.isFinite(started) ? started : null;
  } catch {
    return null;
  }
}

function writeOwnerFlag(owner: boolean): void {
  try {
    if (owner) window.localStorage.setItem(OWNER_STORAGE_KEY, "1");
    else window.localStorage.removeItem(OWNER_STORAGE_KEY);
  } catch {
    // 保存できないブラウザでは、そのページの表示だけを続ける。
  }
}
