import { describe, expect, it } from "@jest/globals";
import { parseOpenDataLicenses } from "@/lib/license/openDataLicenses";

describe("parseOpenDataLicenses loader baseline", () => {
  it("parses valid entries", () => {
    const result = parseOpenDataLicenses([
      { id: "a", name: "dataset", licenseName: "CC BY", provider: "x" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("dataset");
    expect(result[0].licenseName).toBe("CC BY");
  });

  it("returns empty for non-array", () => {
    const result = parseOpenDataLicenses({});
    expect(result).toEqual([]);
  });
});
