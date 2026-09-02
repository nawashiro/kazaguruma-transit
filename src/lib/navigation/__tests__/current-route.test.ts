export {};

type GetCurrentRoute = () => string;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function loadCurrentRoute(): GetCurrentRoute {
  let loaded: unknown;
  let loadError: unknown = null;

  try {
    // Keep the planned navigation boundary collectible before implementation.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    loaded = require("../current-route");
  } catch (error) {
    loadError = error;
  }

  expect(loadError).toBeNull();
  if (loadError !== null) {
    throw new Error(`getCurrentRoute is not implemented: ${String(loadError)}`);
  }

  expect(isRecord(loaded)).toBe(true);
  if (!isRecord(loaded)) {
    throw new Error("current-route module did not expose an object");
  }

  const getCurrentRoute = loaded.getCurrentRoute;
  expect(typeof getCurrentRoute).toBe("function");
  if (typeof getCurrentRoute !== "function") {
    throw new Error("current-route module did not expose getCurrentRoute");
  }

  return getCurrentRoute as GetCurrentRoute;
}

const CURRENT_ROUTE =
  "/routes?origin=35.68%2C139.76&destination=35.7%2C139.78";

describe("getCurrentRoute public boundary", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("returns pathname and search while excluding the hash", () => {
    window.history.replaceState({}, "", `${CURRENT_ROUTE}#results`);

    const getCurrentRoute = loadCurrentRoute();

    expect(getCurrentRoute()).toBe(CURRENT_ROUTE);
    expect(getCurrentRoute()).not.toContain("#results");
  });
});
