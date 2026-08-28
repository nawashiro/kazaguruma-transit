import { resolveSafeReturnTarget } from "@/lib/navigation/safe-return-target";

type AuthenticationRouteMode = "login" | "signup";

function buildAuthRoute(
  mode: AuthenticationRouteMode,
  returnTo: unknown,
  reason?: unknown,
): string {
  const params = new URLSearchParams({
    returnTo: resolveSafeReturnTarget(returnTo),
  });

  if (typeof reason === "string" && reason.trim()) {
    params.set("reason", reason);
  }

  return `/${mode}?${params.toString()}`;
}

export function buildLoginRoute(returnTo: unknown, reason?: unknown): string {
  return buildAuthRoute("login", returnTo, reason);
}

export function buildSignupRoute(returnTo: unknown, reason?: unknown): string {
  return buildAuthRoute("signup", returnTo, reason);
}
