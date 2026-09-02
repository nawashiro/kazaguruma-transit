export {};

type TruncateDiscussionDescription = (description: string) => string;
type PublicModule = Record<string, unknown>;

function isRecord(value: unknown): value is PublicModule {
  return typeof value === "object" && value !== null;
}

function loadTruncateDiscussionDescription(): TruncateDiscussionDescription {
  let loaded: unknown;
  let loadError: unknown = null;

  try {
    // Keep the planned display boundary collectible before implementation.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded public-boundary loader
    loaded = require("../display");
  } catch (error) {
    loadError = error;
  }

  expect(loadError).toBeNull();
  if (loadError !== null) {
    throw new Error(`truncateDiscussionDescription is not implemented: ${String(loadError)}`);
  }

  expect(isRecord(loaded)).toBe(true);
  if (!isRecord(loaded)) {
    throw new Error("display module did not expose an object");
  }

  const truncateDiscussionDescription = loaded.truncateDiscussionDescription;
  expect(typeof truncateDiscussionDescription).toBe("function");
  if (typeof truncateDiscussionDescription !== "function") {
    throw new Error("display module did not expose truncateDiscussionDescription");
  }

  return truncateDiscussionDescription as TruncateDiscussionDescription;
}

describe("truncateDiscussionDescription public boundary", () => {
  it.each([
    ["empty description", ""],
    ["short description", "短い説明"],
    ["exactly 70 characters", "あ".repeat(70)],
  ])("leaves %s unchanged", (_label, description) => {
    const truncateDiscussionDescription = loadTruncateDiscussionDescription();

    expect(truncateDiscussionDescription(description)).toBe(description);
  });

  it("truncates descriptions longer than 70 characters to 70 characters plus an ellipsis", () => {
    const truncateDiscussionDescription = loadTruncateDiscussionDescription();
    const description = "あ".repeat(71);

    expect(truncateDiscussionDescription(description)).toBe(
      `${description.slice(0, 70)}...`,
    );
  });
});