interface JourneyDurationInput {
  isDeparture: boolean;
  requestedTime: string;
  transitDepartureTime: string;
  transitArrivalTime: string;
  walkToFirstStopMinutes: number;
  walkFromLastStopMinutes: number;
}

/**
 * 徒歩距離から所要時間を分単位で返す。距離は徒歩ネットワークから求めた
 * 実際の経路長であり、直線距離の補正は掛けない。
 */
export function calculateWalkingTimeMinutes(
  walkingDistanceKm: number,
  walkingSpeedKmH: number
): number {
  if (walkingSpeedKmH <= 0) {
    throw new Error("歩行速度は0より大きい必要があります");
  }

  return (walkingDistanceKm / walkingSpeedKmH) * 60;
}

/** 徒歩を考慮し、時刻表探索に渡す停留所基準の時刻を返す。 */
export function calculateRouteSearchTime(
  requestedTime: Date,
  isDeparture: boolean,
  walkToFirstStopMinutes: number,
  walkFromLastStopMinutes: number
): Date {
  const walkingMinutes = isDeparture
    ? Math.ceil(walkToFirstStopMinutes)
    : -Math.ceil(walkFromLastStopMinutes);
  return new Date(
    requestedTime.getTime() + walkingMinutes * 60 * 1000
  );
}

/** GTFS時刻（24時以降を含む）を秒へ変換する。 */
export function parseGtfsTime(time: string): number {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    throw new Error(`不正なGTFS時刻です: ${time}`);
  }

  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * ドア・ツー・ドアの所要時間を返す。出発時刻指定では、最初の停留所で
 * 発生する待ち時間も含める。
 */
export function calculateJourneyDurationMinutes({
  isDeparture,
  requestedTime,
  transitDepartureTime,
  transitArrivalTime,
  walkToFirstStopMinutes,
  walkFromLastStopMinutes,
}: JourneyDurationInput): number {
  const transitDurationSeconds =
    parseGtfsTime(transitArrivalTime) - parseGtfsTime(transitDepartureTime);

  if (!isDeparture) {
    return (
      transitDurationSeconds / 60 +
      walkToFirstStopMinutes +
      walkFromLastStopMinutes
    );
  }

  const durationUntilTransitArrivalSeconds =
    parseGtfsTime(transitArrivalTime) - parseGtfsTime(requestedTime);
  return durationUntilTransitArrivalSeconds / 60 + walkFromLastStopMinutes;
}
