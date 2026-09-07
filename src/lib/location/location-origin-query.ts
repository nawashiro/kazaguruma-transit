export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export type LocationOrigin =
  | { originState: "absent" }
  | { originState: "valid"; origin: LocationCoordinates }
  | { originState: "invalid" };

function invalidOrigin(): { originState: "invalid" } {
  return { originState: "invalid" };
}

/** Parses the transient category-page origin query without applying geographic bounds. */
export function parseLocationOrigin(
  value: string | null | undefined,
): LocationOrigin {
  if (value === undefined || value === null) {
    return { originState: "absent" };
  }

  if (typeof value !== "string") {
    return invalidOrigin();
  }

  const components = value.split(",");
  if (components.length !== 2) {
    return invalidOrigin();
  }

  const [latitudeValue, longitudeValue] = components.map((component) =>
    component.trim(),
  );
  if (!latitudeValue || !longitudeValue) {
    return invalidOrigin();
  }

  const lat = Number(latitudeValue);
  const lng = Number(longitudeValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return invalidOrigin();
  }

  return {
    originState: "valid",
    origin: { lat, lng },
  };
}

/** Serializes coordinates in the contract's latitude,longitude order. */
export function serializeLocationOrigin(origin: LocationCoordinates): string {
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    throw new TypeError("origin coordinates must be finite numbers");
  }

  return `${origin.lat},${origin.lng}`;
}
