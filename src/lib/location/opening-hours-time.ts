const JST_OFFSET_MINUTES = 540;

export type TimezoneOffsetFn = (date: Date) => number;

const defaultGetTimezoneOffset: TimezoneOffsetFn = (date) => date.getTimezoneOffset();

export function toLibraryDate(
  date: Date,
  getTimezoneOffset: TimezoneOffsetFn = defaultGetTimezoneOffset,
): Date {
  return new Date(
    date.getTime() + (JST_OFFSET_MINUTES + getTimezoneOffset(date)) * 60_000,
  );
}

export function fromLibraryDate(
  date: Date,
  getTimezoneOffset: TimezoneOffsetFn = defaultGetTimezoneOffset,
): Date {
  return new Date(
    date.getTime() - (JST_OFFSET_MINUTES + getTimezoneOffset(date)) * 60_000,
  );
}
