import { evaluateOpeningHours } from "../opening-hours";

function mondayNoonUtc(): Date {
  return new Date(Date.UTC(2026, 10, 16, 3, 0, 0));
}

function mondayEveningUtc(): Date {
  return new Date(Date.UTC(2026, 10, 16, 12, 0, 0));
}

function tuesdayNoonUtc(): Date {
  return new Date(Date.UTC(2026, 10, 17, 3, 0, 0));
}

describe("evaluateOpeningHours", () => {
  it("reports open and closed for Tu-Su 10:00-17:30", () => {
    const open = evaluateOpeningHours("Tu-Su 10:00-17:30", tuesdayNoonUtc());
    expect(open.state).toBe("open");
    const closed = evaluateOpeningHours("Tu-Su 10:00-17:30", mondayEveningUtc());
    expect(closed.state).toBe("closed");
  });

  it("treats PH off as closed on a Japanese holiday", () => {
    const holidayNoonUtc = new Date(Date.UTC(2026, 10, 3, 3, 0, 0));
    const result = evaluateOpeningHours("Mo-Fr 09:00-17:00; PH off", holidayNoonUtc);
    expect(result.state).toBe("closed");
  });

  it("treats Sa[1] off as closed on the first Saturday", () => {
    const firstSatNoonUtc = new Date(Date.UTC(2026, 10, 7, 3, 0, 0));
    const result = evaluateOpeningHours("Mo-Sa 09:00-17:00; Sa[1] off", firstSatNoonUtc);
    expect(result.state).toBe("closed");
  });

  it("handles overnight Mo-Su 11:00-08:00", () => {
    const lateNightUtc = new Date(Date.UTC(2026, 10, 16, 18, 0, 0));
    const result = evaluateOpeningHours("Mo-Su 11:00-08:00", lateNightUtc);
    expect(result.state).toBe("open");
  });


  it("builds the week from Japanese midnight without moving early openings to another day", () => {
    const now = new Date("2026-11-18T08:21:00Z");
    const result = evaluateOpeningHours("Mo-Fr 08:30-17:00; PH off", now);

    expect(result.state).toBe("closed");
    expect(result.nextChange?.toISOString()).toBe("2026-11-18T23:30:00.000Z");
    expect(result.week).toHaveLength(7);
    expect(result.week?.[0]?.date.toISOString()).toBe("2026-11-17T15:00:00.000Z");
    expect(result.week?.[0]?.intervals).toEqual([
      {
        start: new Date("2026-11-17T23:30:00.000Z"),
        end: new Date("2026-11-18T08:00:00.000Z"),
        endsAtDayEnd: false,
      },
    ]);
    expect(result.week?.[5]?.date.toISOString()).toBe("2026-11-22T15:00:00.000Z");
    expect(result.week?.[5]?.closed).toBe(true);
    expect(result.week?.[6]?.intervals?.[0]?.start.toISOString()).toBe(
      "2026-11-23T23:30:00.000Z",
    );
  });

  it("splits an overnight interval at the Japanese date boundary", () => {
    const now = new Date("2026-11-18T08:21:00Z");
    const result = evaluateOpeningHours("Mo-Su 11:00-08:00", now);

    expect(result.week?.[0]?.intervals).toEqual([
      {
        start: new Date("2026-11-17T15:00:00.000Z"),
        end: new Date("2026-11-17T23:00:00.000Z"),
        endsAtDayEnd: false,
      },
      {
        start: new Date("2026-11-18T02:00:00.000Z"),
        end: new Date("2026-11-18T15:00:00.000Z"),
        endsAtDayEnd: true,
      },
    ]);
  });

  it("builds seven all-day rows for 24/7", () => {
    const now = new Date("2026-11-18T08:21:00Z");
    const result = evaluateOpeningHours("24/7", now);

    expect(result.state).toBe("all-day");
    expect(result.week).toHaveLength(7);
    expect(result.week?.[0]?.intervals).toEqual([
      {
        start: new Date("2026-11-17T15:00:00.000Z"),
        end: new Date("2026-11-18T15:00:00.000Z"),
        endsAtDayEnd: true,
      },
    ]);
  });

  it("reports 24/7 as all-day", () => {
    const result = evaluateOpeningHours("24/7", mondayNoonUtc());
    expect(result.state).toBe("all-day");
  });

  it("returns raw rule when unparsable", () => {
    const result = evaluateOpeningHours("not a rule", mondayNoonUtc());
    expect(result.state).toBe("unknown");
    expect(result.raw).toBe("not a rule");
  });
});
