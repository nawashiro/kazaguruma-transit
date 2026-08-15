export {};

type PublicFunction = (...args: unknown[]) => unknown;
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

function getResolver(state: ModuleState): PublicFunction {
  const publicName = "resolveSafeReturnTarget";
  const modulePath = "../safe-return-target";

  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} could not be loaded (${detail})`,
    );
  }
  if (!state.exports) {
    throw new Error(`${publicName} is not implemented: public module ${modulePath} exported nothing`);
  }

  const resolver = state.exports[publicName];
  if (typeof resolver !== "function") {
    throw new Error(
      `${publicName} is not implemented: public module ${modulePath} does not export ${publicName}`,
    );
  }
  return resolver as PublicFunction;
}

describe("resolveSafeReturnTarget", () => {
  const moduleState = loadModule("../safe-return-target");

  it("accepts a safe relative path and preserves its query", () => {
    const resolve = getResolver(moduleState);

    expect(resolve("/settings?tab=profile")).toBe("/settings?tab=profile");
  });

  it("preserves search conditions when returning to routes", () => {
    const resolve = getResolver(moduleState);

    const target = "/routes?from=chiyoda&to=kanda&date=2026-08-14";
    expect(resolve(target)).toBe(target);
  });

  it("preserves ordinary encoded query data", () => {
    const resolve = getResolver(moduleState);

    const target = "/routes?note=%252f%252fevil";
    expect(resolve(target)).toBe(target);
  });

  it.each([
    "https://evil.example/collect",
    "http://evil.example/collect",
    "//evil.example/collect",
    "///evil.example/collect",
    "https://user:password@evil.example/collect",
    "//user:password@evil.example/collect",
  ])("rejects an external or credential-bearing target: %s", (target) => {
    const resolve = getResolver(moduleState);

    expect(resolve(target)).toBe("/");
  });

  it.each([
    "/login",
    "/signup",
    "/api/transit?type=route",
    "/_next/static/chunks/app.js",
    "/favicon.ico",
  ])("rejects a non-returnable application path: %s", (target) => {
    const resolve = getResolver(moduleState);

    expect(resolve(target)).toBe("/");
  });

  it.each([
    "/foo%2f..%2fapi/transit",
    "/%5c%5cevil.example/",
    "/%252f%252fevil",
    "/%255c%255cevil",
    "/%252e%252e/login",
  ])("rejects encoded path separators that hide traversal or redirects: %s", (target) => {
    const resolve = getResolver(moduleState);

    expect(resolve(target)).toBe("/");
  });

  it.each([
    "/discussions/create?action=publish",
    "/routes?payload=post-content",
    "/routes?draft=unsent-draft",
    "/routes?resumeAction=submit",
  ])("rejects action, payload, draft, or resume state: %s", (target) => {
    const resolve = getResolver(moduleState);

    expect(resolve(target)).toBe("/");
  });

  it.each([undefined, null, "", "settings", "javascript:alert(1)"]) (
    "falls back for malformed or omitted values: %p",
    (target) => {
      const resolve = getResolver(moduleState);

      expect(resolve(target)).toBe("/");
    },
  );
});
