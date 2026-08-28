/** A return target that has passed same-site navigation validation. */
export type SafeReturnTarget = string & {
  readonly __safeReturnTarget: unique symbol;
};

/** Identifies the fixed page that originated a rate-limit state. */
export type RateLimitSource = "home" | "locations" | "routes";

/** Public states rendered by the location detail page. */
export type LocationPageState =
  | "loading"
  | "success"
  | "not-found"
  | "error"
  | "data-load-error";

/** Successful location-data transport result. */
export interface LocationDataSuccess<TCategory> {
  status: "success";
  categories: TCategory[];
}

/** Failed location-data transport result. */
export interface LocationDataError {
  status: "error";
  error: Error;
}

/** Status-preserving result returned by the location-data boundary. */
export type LocationDataLoadResult<TCategory> =
  | LocationDataSuccess<TCategory>
  | LocationDataError;

/** Reasons for a validation or identity error in the location detail result. */
export type LocationDetailErrorReason =
  | "invalid-request-id"
  | "invalid-data"
  | "duplicate-id";

/** Result of resolving one location identifier for the detail page. */
export type LocationDetailResult<TLocation> =
  | { status: "success"; location: TLocation }
  | { status: "not-found" }
  | { status: "error"; error: Error; reason: LocationDetailErrorReason }
  | { status: "data-load-error"; error: Error };
