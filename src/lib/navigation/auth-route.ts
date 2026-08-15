import { resolveSafeReturnTarget } from "@/lib/navigation/safe-return-target";

export function buildLoginRoute(returnTo: unknown, reason?: unknown): string {
  const params = new URLSearchParams({
    returnTo: resolveSafeReturnTarget(returnTo),
  });

  if (typeof reason === "string" && reason.trim()) {
    params.set("reason", reason);
  }

  return `/login?${params.toString()}`;
}
