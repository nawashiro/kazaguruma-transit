import { describe, expect, it } from "@jest/globals";
import { parseProjectMetadata } from "@/lib/license/projectMetadata";

describe("parseProjectMetadata required fields", () => {
  it("returns required metadata from package-like object", () => {
    const result = parseProjectMetadata({
      name: "kazaguruma-transit",
      version: "0.1.0",
      license: "UNLICENSED",
      author: "Nawashiro",
    });

    expect(result.name).toBe("kazaguruma-transit");
    expect(result.version).toBe("0.1.0");
    expect(result.license).toBe("UNLICENSED");
    expect(result.author).toBe("Nawashiro");
  });

  it("falls back to 不明 when required fields are missing", () => {
    const result = parseProjectMetadata({});

    expect(result.name).toBe("不明");
    expect(result.version).toBe("不明");
    expect(result.license).toBe("不明");
    expect(result.author).toBe("不明");
  });
});
