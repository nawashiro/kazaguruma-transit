import "server-only";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { TransitService } from "./transit-service";
import { parseRouteSearchParams, type RouteSearchQuery } from "./route-search-query";
import { createRouteResultViewModel, type RouteResultData, type RouteResultViewModel } from "./route-result-model";
import { logger } from "@/utils/logger";

export type RouteSearchResult =
  | { status: "limited" }
  | { status: "error"; message: string }
  | { status: "success"; query: RouteSearchQuery; routeInfo: RouteResultViewModel };

export async function searchRoutes(
  searchParams: URLSearchParams,
  headers: Pick<Headers, "get">,
): Promise<RouteSearchResult> {
  const limit = await checkRateLimit(getClientIp(headers));
  if (!limit.allowed) return { status: "limited" };

  const parsed = parseRouteSearchParams(searchParams);
  if (!parsed.isValid) return { status: "error", message: parsed.error };

  try {
    const response = await TransitService.getInstance().process({ type: "route", ...parsed.query });
    if (!response.success) throw new Error(response.error || "経路検索失敗");
    return {
      status: "success",
      query: parsed.query,
      routeInfo: createRouteResultViewModel(response.data as RouteResultData | undefined, parsed.query.origin, parsed.query.destination),
    };
  } catch (error) {
    logger.error("サーバー経路検索エラー:", error);
    return { status: "error", message: "経路検索に失敗しました。時間をおいて再度お試しください。" };
  }
}
