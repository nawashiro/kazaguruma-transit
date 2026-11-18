import opening_hours from "opening_hours";
import {
  JST_OFFSET_MINUTES,
  fromLibraryDate,
  toLibraryDate,
} from "./opening-hours-time";

const JST_OFFSET_MS = JST_OFFSET_MINUTES * 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type OpeningState = "open" | "closed" | "all-day" | "unknown";

export interface OpeningDayInterval {
  start: Date;
  end: Date;
  endsAtDayEnd: boolean;
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

export function startOfTokyoDay(date: Date): Date {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - JST_OFFSET_MS);
}

function buildAllDayWeek(now: Date): OpeningDay[] {
  const start = startOfTokyoDay(now);
  return Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(start.getTime() + index * DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    return {
      date: dayStart,
      intervals: [{ start: dayStart, end: dayEnd, endsAtDayEnd: true }],
      closed: false,
    };
  });
}

function buildWeek(
  parsed: opening_hours,
  now: Date,
): OpeningDay[] | undefined {
  try {
    const start = startOfTokyoDay(now);
    const libraryStart = toLibraryDate(start);
    const libraryEnd = new Date(libraryStart.getTime() + 7 * DAY_MS);
    const rawIntervals = parsed.getOpenIntervals(libraryStart, libraryEnd) as unknown as Array<
      [Date, Date]
    >;
    const intervals = rawIntervals.map(([from, to]) => ({
      from: fromLibraryDate(from),
      to: fromLibraryDate(to),
    }));

    return Array.from({ length: 7 }, (_, index) => {
      const dayStart = new Date(start.getTime() + index * DAY_MS);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const dayIntervals = intervals
        .filter((interval) => interval.from < dayEnd && interval.to > dayStart)
        .map((interval) => ({
          start: interval.from < dayStart ? dayStart : interval.from,
          end: interval.to > dayEnd ? dayEnd : interval.to,
          endsAtDayEnd: interval.to >= dayEnd,
        }));

      return {
        date: dayStart,
        intervals: dayIntervals,
        closed: dayIntervals.length === 0,
      };
    });
  } catch {
    return undefined;
  }
}

export function evaluateOpeningHours(
  rule: string,
  now: Date,
): OpeningHoursEvaluation {
  const showHolidayWarning = !hasPhOrSh(rule);

  if (rule.trim() === "24/7") {
    return {
      state: "all-day",
      raw: rule,
      week: buildAllDayWeek(now),
      showHolidayWarning,
    };
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

  return {
    state: isOpen ? "open" : "closed",
    raw: rule,
    nextChange,
    week: buildWeek(parsed, now),
    showHolidayWarning,
  };
}
