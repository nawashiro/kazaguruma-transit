import { TRANSIT_PARAMS } from "@/lib/transit/transit-params";
import { calculateWalkingTimeMinutes } from "@/lib/transit/walking";
import type { CalendarRoute, CalendarStop, RouteCalendarInput } from "@/types/calendar";

const CALENDAR_PRODUCT_ID = "-//Kazaguruma Transit//Route Calendar//JA";
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;
const INITIAL_WALK_ALARM_MINUTES = 10;
const STANDARD_ALARM_MINUTES = 5;

interface CalendarLocation {
  name: string;
  latitude?: number;
  longitude?: number;
}

interface CalendarEvent {
  summary: string;
  start: Date;
  end: Date;
  alarmMinutes: number;
  location: CalendarLocation;
}

interface TransitLeg {
  route: CalendarRoute;
  boardingStop: CalendarLocation;
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

function getStraightLineDistanceKm(
  stop: CalendarStop,
  pointLatitude?: number,
  pointLongitude?: number
): number {
  if (stop.distance > 0) return stop.distance;

  const stopLatitude = stop.stop_lat;
  const stopLongitude = stop.stop_lon;
  if (
    pointLatitude === undefined ||
    pointLongitude === undefined ||
    stopLatitude === undefined ||
    stopLongitude === undefined
  ) {
    return 0;
  }

  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const latitudeDifference = toRadians(stopLatitude - pointLatitude);
  const longitudeDifference = toRadians(stopLongitude - pointLongitude);
  const firstLatitude = toRadians(pointLatitude);
  const secondLatitude = toRadians(stopLatitude);
  const haversineValue =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(
    Math.sqrt(haversineValue),
    Math.sqrt(1 - haversineValue)
  );
}

function calculateRoundedWalkingMinutes(distanceKm: number): number {
  return Math.ceil(
    calculateWalkingTimeMinutes(distanceKm, TRANSIT_PARAMS.WALKING_SPEED_KM_H)
  );
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
    legs.push({ route, boardingStop, departure, arrival });

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
  const legs = collectTransitLegs(input);
  const firstLeg = legs[0];
  const lastLeg = legs[legs.length - 1];
  const originWalkingMinutes = calculateRoundedWalkingMinutes(
    getStraightLineDistanceKm(input.originStop, input.originLat, input.originLng)
  );
  const destinationWalkingMinutes = calculateRoundedWalkingMinutes(
    getStraightLineDistanceKm(input.destinationStop, input.destLat, input.destLng)
  );

  const events: CalendarEvent[] = [
    {
      summary: `歩き ${input.originStop.stopName}バス停へ`,
      start: new Date(
        firstLeg.departure.getTime() - originWalkingMinutes * MILLISECONDS_PER_MINUTE
      ),
      end: firstLeg.departure,
      alarmMinutes: INITIAL_WALK_ALARM_MINUTES,
      location: getStopLocation(input.originStop),
    },
  ];

  legs.forEach((leg, index) => {
    events.push({
      summary: `風ぐるま ${leg.boardingStop.name} ${leg.route.routeName}`,
      start: leg.departure,
      end: leg.arrival,
      alarmMinutes: STANDARD_ALARM_MINUTES,
      location: leg.boardingStop,
    });

    const nextLeg = legs[index + 1];
    if (nextLeg) {
      events.push({
        summary: `乗り換え ${nextLeg.boardingStop.name}`,
        start: leg.arrival,
        end: nextLeg.departure,
        alarmMinutes: STANDARD_ALARM_MINUTES,
        location: nextLeg.boardingStop,
      });
    }
  });

  events.push({
    summary: `歩き ${input.destinationStop.stopName}バス停から`,
    start: lastLeg.arrival,
    end: new Date(
      lastLeg.arrival.getTime() + destinationWalkingMinutes * MILLISECONDS_PER_MINUTE
    ),
    alarmMinutes: STANDARD_ALARM_MINUTES,
    location: getStopLocation(input.destinationStop),
  });
  return events;
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
      `TRIGGER:-PT${event.alarmMinutes}M`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(event.summary)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return `${lines.flatMap(foldIcsLine).join("\r\n")}\r\n`;
}
