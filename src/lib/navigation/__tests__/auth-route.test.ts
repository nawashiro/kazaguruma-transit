export {};

type PublicFunction = (returnTo: unknown, reason?: unknown) => string;
type PublicModule = Record<string, unknown>;

type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};

function loadModule(modulePath: string): ModuleState {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    const loaded: unknown = require(modulePath);
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error(`Expected ${modulePath} to export an object`),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function getRouteBuilder(
  state: ModuleState,
  publicName: "buildLoginRoute" | "buildSignupRoute",
): PublicFunction {
  const modulePath = "../auth-route";

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(`${publicName} is not implemented: public module ${modulePath} exported nothing`);
  }

  const builder = state.exports[publicName];
  if (typeof builder !== "function") {
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} does not export ${publicName}`,
    );
  }
  return builder as PublicFunction;
}

function assertRouteTarget(
  route: string,
  expectedPathname: "/login" | "/signup",
  expectedReturnTo: string,
  expectedReason?: string,
) {
  const target = new URL(route, "https://kazaguruma.invalid");

  expect(target.pathname).toBe(expectedPathname);
  expect(target.searchParams.get("returnTo")).toBe(expectedReturnTo);
  expect(target.searchParams.get("reason")).toBe(expectedReason ?? null);
  expect(target.searchParams.has("action")).toBe(false);
  expect(target.searchParams.has("payload")).toBe(false);
  expect(target.searchParams.has("draft")).toBe(false);
}

const moduleState = loadModule("../auth-route");
const authRoutes = [
  ["login", "buildLoginRoute", "/login"] as const,
  ["signup", "buildSignupRoute", "/signup"] as const,
];

const unsafeReturnTargets: unknown[] = [
  undefined,
  null,
  "/login",
  "/signup",
  "https://evil.example/collect",
  "//evil.example/collect",
  "/discussions/create?action=post",
  "/settings?payload=draft",
];

describe("authentication route builders", () => {
  it.each(authRoutes)(
    "%s builder creates a safe route and preserves an explicit reason",
    (_mode, publicName, expectedPathname) => {
      const buildRoute = getRouteBuilder(moduleState, publicName);
      const route = buildRoute("/settings?tab=profile", "認証が必要です。");

      assertRouteTarget(
        route,
        expectedPathname,
        "/settings?tab=profile",
        "認証が必要です。",
      );
    },
  );

  it.each(authRoutes)(
    "%s builder omits optional reason and action-like state for a safe return",
    (_mode, publicName, expectedPathname) => {
      const buildRoute = getRouteBuilder(moduleState, publicName);
      const route = buildRoute("/settings");

      assertRouteTarget(route, expectedPathname, "/settings");
    },
  );

  it.each(authRoutes)(
    "%s builder falls back to the root for unknown or dangerous returnTo values",
    (_mode, publicName, expectedPathname) => {
      const buildRoute = getRouteBuilder(moduleState, publicName);

      for (const returnTo of unsafeReturnTargets) {
        const route = buildRoute(returnTo);
        assertRouteTarget(route, expectedPathname, "/");
      }
    },
  );
});
