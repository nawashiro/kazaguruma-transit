/**
 * Returns the current browser path and query string without the hash.
 *
 * A relative path keeps authentication return targets within the application
 * and also makes the helper safe to call during server rendering.
 */
export function getCurrentRoute(): string {
  try {
    if (typeof window === "undefined") {
      return "/";
    }

    const { pathname, search } = window.location;
    if (
      typeof pathname !== "string" ||
      typeof search !== "string" ||
      !pathname.startsWith("/") ||
      pathname.startsWith("//")
    ) {
      return "/";
    }

    const hashIndex = search.indexOf("#");
    const searchWithoutHash =
      hashIndex === -1 ? search : search.slice(0, hashIndex);

    return `${pathname}${searchWithoutHash}`;
  } catch {
    return "/";
  }
}
