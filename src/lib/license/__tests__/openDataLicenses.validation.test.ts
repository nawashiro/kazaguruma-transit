import { describe, expect, it } from "@jest/globals";
import { parseOpenDataLicenses } from "@/lib/license/openDataLicenses";

describe("parseOpenDataLicenses validation", () => {
  it("throws on duplicate id", () => {
    expect(() =>
      parseOpenDataLicenses([
        { id: "same", name: "A", licenseName: "CC BY" },
        { id: "same", name: "B", licenseName: "CC BY-SA" },
      ])
    ).toThrow("Duplicate open data id");
  });

  it("throws when required fields are missing", () => {
    expect(() => parseOpenDataLicenses([{ id: "x", name: "A" }])).toThrow(
      "Invalid open data entry"
    );
  });
});
