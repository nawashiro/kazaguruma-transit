import { describe, expect, it } from "@jest/globals";
import { parseProjectMetadata } from "@/lib/license/projectMetadata";

describe("parseProjectMetadata optional field normalization", () => {
  it("normalizes repository object and funding array", () => {
    const result = parseProjectMetadata({
      name: "app",
      version: "1.0.0",
      license: "MIT",
      author: { name: "Team" },
      repository: { url: "https://github.com/example/repo" },
      funding: [{ url: "https://example.com/sponsor" }, "https://github.com/sponsors/example"],
    });

    expect(result.author).toBe("Team");
    expect(result.repository).toBe("https://github.com/example/repo");
    expect(result.funding).toEqual([
      "https://example.com/sponsor",
      "https://github.com/sponsors/example",
    ]);
  });

  it("omits repository/funding when empty", () => {
    const result = parseProjectMetadata({
      name: "app",
      version: "1.0.0",
      license: "MIT",
      author: "Team",
    });

    expect(result.repository).toBeUndefined();
    expect(result.funding).toBeUndefined();
  });
});
