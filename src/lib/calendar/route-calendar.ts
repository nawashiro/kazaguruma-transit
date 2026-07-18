import type {
  CalendarRoute,
  CalendarStop,
  RouteCalendarInput,
} from "@/types/calendar";

const CALENDAR_PRODUCT_ID = "-//Kazaguruma Transit//Route Calendar//JA";
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;
const BOARDING_ALARM_MINUTES = 10;
const ALIGHTING_ALARM_MINUTES = 5;

interface CalendarLocation {
  name: string;
  latitude?: number;
  longitude?: number;
}

interface CalendarEvent {
  summary: string;
  start: Date;
  end: Date;
  location: CalendarLocation;
}

interface TransitLeg {
  route: CalendarRoute;
  boardingStop: CalendarLocation;
  alightingStop: CalendarLocation;
  departure: Date;
  arrival: Date;
}

function parseServiceDate(selectedDateTime: string): {
  year: number;
  monthIndex: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(selectedDateTime);
  if (!match) throw new Error("カレンダーに必要な日付情報がありません");

  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
    day: Number(match[3]),
  };
}

function parseRouteTime(
  time: string | undefined,
  serviceDate: ReturnType<typeof parseServiceDate>,
  earliest?: Date
): Date {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time ?? "");
  if (!match) throw new Error("カレンダーに必要な時刻情報がありません");

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  if (minutes > 59 || seconds > 59) {
    throw new Error("カレンダーに必要な時刻情報がありません");
  }

  let result = new Date(
    serviceDate.year,
    serviceDate.monthIndex,
    serviceDate.day,
    hours,
    minutes,
    seconds,
    0
  );
  while (earliest && result < earliest) {
    result = new Date(result.getTime() + MILLISECONDS_PER_DAY);
  }
  return result;
}

function getStopLocation(stop: CalendarStop): CalendarLocation {
  return {
    name: stop.stopName,
    latitude: stop.stop_lat,
    longitude: stop.stop_lon,
  };
}

function collectTransitLegs(input: RouteCalendarInput): TransitLeg[] {
  const firstRoute = input.routes[0];
  if (!firstRoute) throw new Error("有効な経路情報がありません");

  const serviceDate = parseServiceDate(input.selectedDateTime);
  const legs: TransitLeg[] = [];

  const appendRoute = (
    route: CalendarRoute,
    boardingStop: CalendarLocation,
    earliest?: Date
  ) => {
    const departure = parseRouteTime(route.departureTime, serviceDate, earliest);
    const arrival = parseRouteTime(route.arrivalTime, serviceDate, departure);
    const nextTransfer = route.transfers?.[0];
    const alightingStop = nextTransfer
      ? {
          name: nextTransfer.transferStop.stopName,
          latitude: nextTransfer.transferStop.stopLat,
          longitude: nextTransfer.transferStop.stopLon,
        }
      : getStopLocation(input.destinationStop);
    legs.push({ route, boardingStop, alightingStop, departure, arrival });

    route.transfers?.forEach((transfer) => {
      appendRoute(
        transfer.nextRoute,
        {
          name: transfer.transferStop.stopName,
          latitude: transfer.transferStop.stopLat,
          longitude: transfer.transferStop.stopLon,
        },
        arrival
      );
    });
  };

  appendRoute(firstRoute, getStopLocation(input.originStop));
  return legs;
}

function buildEvents(input: RouteCalendarInput): CalendarEvent[] {
  return collectTransitLegs(input).map((leg) => {
    const { boardingStop, alightingStop, route } = leg;
    return {
      summary: `風ぐるま ${boardingStop.name} ${route.routeName} ${alightingStop.name}`,
      start: leg.departure,
      end: leg.arrival,
      location: boardingStop,
    };
  });
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(
    date.getHours()
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatUtcDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldIcsLine(line: string): string[] {
  const foldedLines: string[] = [];
  let currentLine = "";
  let currentBytes = 0;

  for (const character of line) {
    const characterBytes = new TextEncoder().encode(character).length;
    const limit = foldedLines.length === 0 ? 75 : 74;
    if (currentBytes + characterBytes > limit) {
      foldedLines.push(foldedLines.length === 0 ? currentLine : ` ${currentLine}`);
      currentLine = character;
      currentBytes = characterBytes;
    } else {
      currentLine += character;
      currentBytes += characterBytes;
    }
  }

  foldedLines.push(foldedLines.length === 0 ? currentLine : ` ${currentLine}`);
  return foldedLines;
}

/** 経路をRFC 5545互換のiCalendar文字列へ変換する。 */
export function buildRouteCalendar(input: RouteCalendarInput): string {
  const generatedAt = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${CALENDAR_PRODUCT_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:風ぐるま乗換案内",
  ];

  buildEvents(input).forEach((event, index) => {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${formatLocalDateTime(event.start)}-${index}@kazaguruma-transit.local`,
      `DTSTAMP:${formatUtcDateTime(generatedAt)}`,
      `SUMMARY:${escapeIcsText(event.summary)}`,
      `DTSTART:${formatLocalDateTime(event.start)}`,
      `DTEND:${formatLocalDateTime(event.end)}`,
      `LOCATION:${escapeIcsText(event.location.name)}`
    );
    if (
      event.location.latitude !== undefined &&
      event.location.longitude !== undefined
    ) {
      lines.push(`GEO:${event.location.latitude};${event.location.longitude}`);
    }
    lines.push(
      "BEGIN:VALARM",
      `TRIGGER:-PT${BOARDING_ALARM_MINUTES}M`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(event.summary)}`,
      "END:VALARM",
      "BEGIN:VALARM",
      `TRIGGER;RELATED=END:-PT${ALIGHTING_ALARM_MINUTES}M`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(event.summary)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return `${lines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}
