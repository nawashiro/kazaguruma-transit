import type { SafeReturnTarget } from "@/types/access-route-pages";

const SAME_SITE_ORIGIN = "https://kazaguruma.invalid";
const DEFAULT_RETURN_TARGET = "/" as SafeReturnTarget;
const FORBIDDEN_QUERY_PREFIXES = ["action", "payload", "draft", "resume"] as const;
const STATIC_ASSET_PATH_PATTERN = /\.(?:css|js|mjs|cjs|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot)$/i;
const MAX_PATH_DECODING_PASSES = 3;

function hasMalformedPercentEncoding(value: string): boolean {
  return /%(?![0-9a-fA-F]{2})/.test(value);
}

function getRawPathname(value: string): string {
  const queryStart = value.indexOf("?");
  return queryStart === -1 ? value : value.slice(0, queryStart);
}

function hasEncodedPathSeparator(pathname: string): boolean {
  return /%(?:2f|5c)/i.test(pathname);
}

function hasTraversalSegment(pathname: string): boolean {
  return pathname.split("/").some((segment) => segment === "." || segment === "..");
}

function isUnsafeDecodedPath(pathname: string): boolean {
  return (
    pathname.includes("\\") ||
    pathname.includes("//") ||
    hasTraversalSegment(pathname) ||
    isForbiddenApplicationPath(pathname)
  );
}

function decodePathForValidation(pathname: string): string | null {
  let decodedPath = pathname;

  for (let pass = 0; pass < MAX_PATH_DECODING_PASSES; pass += 1) {
    if (hasEncodedPathSeparator(decodedPath)) {
      return null;
    }
    if (hasMalformedPercentEncoding(decodedPath)) {
      return decodedPath;
    }

    let nextPath: string;
    try {
      nextPath = decodeURIComponent(decodedPath);
    } catch {
      return null;
    }

    if (isUnsafeDecodedPath(nextPath)) {
      return null;
    }
    if (nextPath === decodedPath) {
      return nextPath;
    }

    decodedPath = nextPath;
  }

  return null;
}

function isForbiddenApplicationPath(pathname: string): boolean {
  const normalizedPath = pathname.toLowerCase();

  return (
    normalizedPath === "/login" ||
    normalizedPath === "/signup" ||
    normalizedPath === "/api" ||
    normalizedPath.startsWith("/api/") ||
    normalizedPath === "/_next" ||
    normalizedPath.startsWith("/_next/") ||
    normalizedPath === "/static" ||
    normalizedPath.startsWith("/static/") ||
    normalizedPath === "/assets" ||
    normalizedPath.startsWith("/assets/") ||
    normalizedPath === "/public" ||
    normalizedPath.startsWith("/public/") ||
    STATIC_ASSET_PATH_PATTERN.test(normalizedPath) ||
    normalizedPath === "/favicon.ico" ||
    normalizedPath === "/robots.txt" ||
    normalizedPath === "/sitemap.xml"
  );
}

function hasForbiddenQueryParameter(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    const normalizedKey = key.toLowerCase();
    if (
      FORBIDDEN_QUERY_PREFIXES.some(
        (prefix) => normalizedKey === prefix || normalizedKey.startsWith(prefix),
      )
    ) {
      return true;
    }
  }
  return false;
}

function isSafeRelativeUrl(value: string): boolean {
  const rawPathname = getRawPathname(value);
  if (
    value.length === 0 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    rawPathname.includes("\\") ||
    value.includes("#") ||
    hasEncodedPathSeparator(rawPathname) ||
    hasTraversalSegment(rawPathname) ||
    hasMalformedPercentEncoding(value)
  ) {
    return false;
  }

  const decodedPath = decodePathForValidation(rawPathname);
  if (decodedPath === null) {
    return false;
  }

  let url: URL;
  try {
    url = new URL(value, SAME_SITE_ORIGIN);
  } catch {
    return false;
  }

  if (
    url.origin !== SAME_SITE_ORIGIN ||
    url.username !== "" ||
    url.password !== "" ||
    url.protocol !== "https:" ||
    isForbiddenApplicationPath(url.pathname) ||
    hasForbiddenQueryParameter(url)
  ) {
    return false;
  }

  return !isUnsafeDecodedPath(url.pathname) && !isUnsafeDecodedPath(decodedPath);
}

/**
 * Validates a same-site relative path and query for authentication return.
 *
 * Action-like query state is deliberately rejected so authentication never
 * replays a pending side effect after returning to the originating page.
 */
export function resolveSafeReturnTarget(value: unknown): SafeReturnTarget {
  if (typeof value !== "string" || !isSafeRelativeUrl(value)) {
    return DEFAULT_RETURN_TARGET;
  }

  return value as SafeReturnTarget;
}
