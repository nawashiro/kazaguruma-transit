import opening_hours from "opening_hours";
import { fromLibraryDate, toLibraryDate } from "./opening-hours-time";

export type OpeningState = "open" | "closed" | "all-day" | "unknown";

export interface OpeningDayInterval {
  start: Date;
  end: Date;
}

export interface OpeningDay {
  date: Date;
  intervals: OpeningDayInterval[];
  closed: boolean;
}

export interface OpeningHoursEvaluation {
  state: OpeningState;
  raw: string;
  nextChange?: Date;
  week?: OpeningDay[];
  showHolidayWarning: boolean;
}

const TOKYO_STATE = { country_code: "jp", state: "東京都" } as const;

function hasPhOrSh(rule: string): boolean {
  return /\b(PH|SH)\b/.test(rule);
}

function tryParse(rule: string): opening_hours | null {
  try {
    return new opening_hours(rule, {
      lat: "35.694",
      lon: "139.753",
      address: TOKYO_STATE,
    });
  } catch {
    return null;
  }
}

export function evaluateOpeningHours(rule: string, now: Date): OpeningHoursEvaluation {
  const showHolidayWarning = !hasPhOrSh(rule);
  if (rule.trim() === "24/7") {
    return { state: "all-day", raw: rule, showHolidayWarning };
  }
  const parsed = tryParse(rule);
  if (parsed === null) {
    return { state: "unknown", raw: rule, showHolidayWarning };
  }
  let isOpen: boolean;
  try {
    isOpen = parsed.getState(toLibraryDate(now));
  } catch {
    return { state: "unknown", raw: rule, showHolidayWarning };
  }
  let nextChange: Date | undefined;
  try {
    const rawNext = parsed.getNextChange(toLibraryDate(now));
    if (rawNext !== undefined) {
      nextChange = fromLibraryDate(rawNext);
    }
  } catch {
    nextChange = undefined;
  }
  let week: OpeningDay[] | undefined;
  try {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const libraryStart = toLibraryDate(start);
    const libraryEnd = new Date(libraryStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const rawIntervals = parsed.getOpenIntervals(libraryStart, libraryEnd) as unknown as Array<[Date, Date, unknown, unknown]>;
    const intervals = rawIntervals.map(([from, to]) => ({ from, to }));
    const days: OpeningDay[] = [];
    for (let i = 0; i < 7; i += 1) {
      const dayStartUtc = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);
      const dayIntervals = intervals
        .map((interval) => ({
          start: fromLibraryDate(interval.from),
          end: fromLibraryDate(interval.to),
        }))
        .filter((interval) => interval.start < dayEndUtc && interval.end > dayStartUtc)
        .map((interval) => ({
          start: interval.start < dayStartUtc ? dayStartUtc : interval.start,
          end: interval.end > dayEndUtc ? dayEndUtc : interval.end,
        }));
      days.push({
        date: dayStartUtc,
        intervals: dayIntervals,
        closed: dayIntervals.length === 0,
      });
    }
    week = days;
  } catch {
    week = undefined;
  }
  return {
    state: isOpen ? "open" : "closed",
    raw: rule,
    nextChange,
    week,
    showHolidayWarning,
  };
}
