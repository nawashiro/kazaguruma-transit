import { resolveSafeReturnTarget } from "@/lib/navigation/safe-return-target";

type AuthenticationRouteMode = "login" | "signup";

function buildAuthRoute(
  mode: AuthenticationRouteMode,
  returnTo: unknown,
): string {
  const params = new URLSearchParams({
    returnTo: resolveSafeReturnTarget(returnTo),
  });

  return `/${mode}?${params.toString()}`;
}

export function buildLoginRoute(returnTo: unknown): string {
  return buildAuthRoute("login", returnTo);
}

export function buildSignupRoute(returnTo: unknown): string {
  return buildAuthRoute("signup", returnTo);
}
