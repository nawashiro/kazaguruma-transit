import opening_hours from "opening_hours";
import { toLibraryDate } from "../opening-hours-time";

describe("opening-hours JST integration", () => {
  it("evaluates an open rule as open at Japan 12:00 with default offset", () => {
    const mondayNoonUtc = new Date(Date.UTC(2026, 10, 16, 3, 0, 0));
    const libraryDate = toLibraryDate(mondayNoonUtc);
    const oh = new opening_hours("Mo 09:00-18:00", {
      lat: "35.694",
      lon: "139.753",
      address: { country_code: "jp", state: "東京都" },
    });
    expect(oh.getState(libraryDate)).toBe(true);
  });
});
