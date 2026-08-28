import type {
  RateLimitSource,
} from "@/types/access-route-pages";

export type RateLimitReturnPath = "/" | "/locations";

const RATE_LIMIT_RETURN_PATHS: Record<RateLimitSource, RateLimitReturnPath> = {
  home: "/",
  locations: "/locations",
  routes: "/",
};

/** Maps an allowlisted source token to its fixed, same-site return path. */
export function getRateLimitReturnPath(source: unknown): RateLimitReturnPath {
  if (source === "home" || source === "locations" || source === "routes") {
    return RATE_LIMIT_RETURN_PATHS[source];
  }

  return "/locations";
}
