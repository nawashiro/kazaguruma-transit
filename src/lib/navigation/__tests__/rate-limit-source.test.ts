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

function getReturnPath(state: ModuleState): PublicFunction {
  const publicName = "getRateLimitReturnPath";
  const modulePath = "../rate-limit-source";

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

describe("getRateLimitReturnPath", () => {
  const moduleState = loadModule("../rate-limit-source");

  it.each([
    ["home", "/"],
    ["locations", "/locations"],
    ["routes", "/"],
  ])("maps the allowlisted source %s to %s", (source, expectedPath) => {
    const resolve = getReturnPath(moduleState);

    expect(resolve(source)).toBe(expectedPath);
  });

  it.each([undefined, "", "unknown", "settings", null])(
    "uses /locations for an omitted or invalid source: %p",
    (source) => {
      const resolve = getReturnPath(moduleState);

      expect(resolve(source)).toBe("/locations");
    },
  );

  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/admin",
    "/routes?from=chiyoda&to=kanda",
  ])("rejects a raw URL or path instead of interpreting it as a source: %s", (rawValue) => {
    const resolve = getReturnPath(moduleState);

    expect(resolve(rawValue)).toBe("/locations");
  });
});
