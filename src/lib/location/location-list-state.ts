export interface LocationWithDistance {
  lat: number;
  lng: number;
  distance?: number;
  [key: string]: unknown;
}

export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1Rad) * Math.cos(lat2Rad);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function sortLocationsByDistance<T extends LocationWithDistance>(
  locations: T[],
): T[] {
  return locations
    .map((location, index) => ({ location, index }))
    .sort((first, second) => {
      const firstDistance = first.location.distance ?? Infinity;
      const secondDistance = second.location.distance ?? Infinity;

      if (firstDistance < secondDistance) {
        return -1;
      }
      if (firstDistance > secondDistance) {
        return 1;
      }
      return first.index - second.index;
    })
    .map(({ location }) => location);
}
