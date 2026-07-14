export type RouteSearchStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "rate-limited"
  | "error";

export interface RouteSearchResult<T = unknown> {
  routeInfo: T;
}

export interface RouteSearchState<T = unknown> {
  status: RouteSearchStatus;
  requestId: number;
  result: RouteSearchResult<T> | null;
  message: string | null;
}

export type RouteSearchAction<T = unknown> =
  | { type: "start"; requestId: number }
  | { type: "success"; requestId: number; result: RouteSearchResult<T> }
  | { type: "empty"; requestId: number; message: string }
  | { type: "rate-limited"; requestId: number; message?: string }
  | { type: "error"; requestId: number; message: string }
  | { type: "reset" };

export function createInitialRouteSearchState<T = unknown>(): RouteSearchState<T> {
  return { status: "idle", requestId: 0, result: null, message: null };
}

function isStaleRequest(
  state: RouteSearchState,
  action: { requestId: number },
): boolean {
  return action.requestId < state.requestId;
}

export function reduceRouteSearchState<T>(
  state: RouteSearchState<T>,
  action: RouteSearchAction<T>,
): RouteSearchState<T> {
  if (action.type === "reset") {
    return { ...createInitialRouteSearchState<T>(), requestId: state.requestId + 1 };
  }

  if (isStaleRequest(state, action)) {
    return state;
  }

  switch (action.type) {
    case "start":
      return { status: "loading", requestId: action.requestId, result: null, message: null };
    case "success":
      return { status: "success", requestId: action.requestId, result: action.result, message: null };
    case "empty":
      return { status: "empty", requestId: action.requestId, result: null, message: action.message };
    case "rate-limited":
      return { status: "rate-limited", requestId: action.requestId, result: null, message: action.message ?? null };
    case "error":
      return { status: "error", requestId: action.requestId, result: null, message: action.message };
  }
}
