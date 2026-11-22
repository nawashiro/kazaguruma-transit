import { fromLibraryDate, toLibraryDate } from "../opening-hours-time";

describe("opening-hours-time JST adapter", () => {
  const utcNoon = new Date(Date.UTC(2026, 4, 1, 3, 0, 0));

  it("produces the same Japan wall time for getTimezoneOffset 0 and -540", () => {
    const fromUtc = toLibraryDate(utcNoon, () => 0);
    const fromTokyo = toLibraryDate(utcNoon, () => -540);

    expect(fromUtc.getTime() - fromTokyo.getTime()).toBe(9 * 60 * 60 * 1000);
    expect(fromUtc.getUTCHours()).toBe(12);
  });

  it("round-trips through the library and back", () => {
    for (const getTimezoneOffset of [() => 0, () => -540]) {
      const libraryDate = toLibraryDate(utcNoon, getTimezoneOffset);
      const restored = fromLibraryDate(libraryDate, getTimezoneOffset);
      expect(restored.getTime()).toBe(utcNoon.getTime());
    }
  });
});
