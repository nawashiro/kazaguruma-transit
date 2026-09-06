"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import LocationCard from "@/components/features/LocationCard";
import {
  calculateDistance,
  geocodeAddress,
  sortLocationsByDistance,
} from "@/lib/location/location-list-state";
import type { LocationPageLocation } from "@/types/location-pages";

interface LocationCategoryListProps {
  locations: readonly LocationPageLocation[];
}

type AreaGroup = readonly [string, LocationPageLocation[]];

type SortableLocation = LocationPageLocation & {
  distance: number;
};

const GEOLOCATION_PERMISSION_DENIED = 1;
const GEOLOCATION_POSITION_UNAVAILABLE = 2;
const GEOLOCATION_TIMEOUT = 3;

function groupLocationsByArea(
  locations: readonly LocationPageLocation[],
): AreaGroup[] {
  const groups = new Map<string, LocationPageLocation[]>();

  for (const location of locations) {
    const areaName = location.areaName || "地域不明";
    const areaLocations = groups.get(areaName);
    if (areaLocations) {
      areaLocations.push(location);
    } else {
      groups.set(areaName, [location]);
    }
  }

  return Array.from(groups.entries()).sort(([first], [second]) =>
    first.localeCompare(second, "ja"),
  );
}

function sortLocationsFromPosition(
  locations: readonly LocationPageLocation[],
  latitude: number,
  longitude: number,
): LocationPageLocation[] {
  const locationsWithDistance: SortableLocation[] = locations.map((location) => ({
    ...location,
    distance: calculateDistance(latitude, longitude, location.lat, location.lng),
  }));

  return sortLocationsByDistance(locationsWithDistance);
}

function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case GEOLOCATION_PERMISSION_DENIED:
      return "現在地（GPS）の利用が拒否されました。住所を検索してください。";
    case GEOLOCATION_POSITION_UNAVAILABLE:
      return "現在地（GPS）を取得できません。住所を検索してください。";
    case GEOLOCATION_TIMEOUT:
      return "現在地（GPS）の取得に失敗しました（時間切れ）。住所を検索してください。";
    default:
      return "現在地（GPS）の取得に失敗しました。住所を検索してください。";
  }
}

function RateLimitRedirect() {
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) {
      return;
    }

    hasRedirected.current = true;
    router.push("/rate-limit?source=locations");
  }, [router]);

  return (
    <p role="status" className="text-base">
      住所検索の利用制限に達したため、案内ページへ移動しています。
    </p>
  );
}

/** 生成済み施設を事前計算済みの地域ごとに表示し、明示操作時だけ距離順にする。 */
export default function LocationCategoryList({
  locations,
}: LocationCategoryListProps) {
  const controlId = useId();
  const addressInputId = `${controlId}-address`;
  const gpsErrorId = `${controlId}-gps-error`;
  const addressErrorId = `${controlId}-address-error`;
  const requestVersionRef = useRef(0);
  const [displayedLocations, setDisplayedLocations] = useState<
    LocationPageLocation[]
  >(() => [...locations]);
  const [isDistanceSorted, setIsDistanceSorted] = useState(false);
  const [address, setAddress] = useState("");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRateLimitRedirecting, setIsRateLimitRedirecting] = useState(false);

  useEffect(() => {
    requestVersionRef.current += 1;
    setDisplayedLocations([...locations]);
    setIsDistanceSorted(false);
    setGpsError(null);
    setAddressError(null);
    setStatusMessage(null);
    setIsLoading(false);
    setIsRateLimitRedirecting(false);
  }, [locations]);

  const handleUseCurrentLocation = () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    setGpsError(null);
    setAddressError(null);
    setStatusMessage(null);
    setIsLoading(true);
    setIsRateLimitRedirecting(false);

    if (!navigator.geolocation) {
      setGpsError("現在地（GPS）を取得できません。住所を検索してください。");
      setIsLoading(false);
      return;
    }

    const handleFailure = (error: GeolocationPositionError) => {
      if (requestVersionRef.current !== requestVersion) {
        return;
      }

      setGpsError(getGeolocationErrorMessage(error));
      setIsLoading(false);
    };

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (requestVersionRef.current !== requestVersion) {
            return;
          }

          try {
            const sortedLocations = sortLocationsFromPosition(
              locations,
              position.coords.latitude,
              position.coords.longitude,
            );
            setDisplayedLocations(sortedLocations);
            setIsDistanceSorted(true);
            setStatusMessage("距離の近い順に施設を表示しています。");
            setIsLoading(false);
          } catch {
            setGpsError(
              "現在地（GPS）を使った距離計算に失敗しました。住所を検索してください。",
            );
            setIsLoading(false);
          }
        },
        handleFailure,
      );
    } catch {
      setGpsError("現在地（GPS）を取得できません。住所を検索してください。");
      setIsLoading(false);
    }
  };

  const handleAddressSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    setGpsError(null);
    setAddressError(null);
    setStatusMessage(null);
    setIsLoading(true);
    setIsRateLimitRedirecting(false);

    try {
      const result = await geocodeAddress(address);

      if (requestVersionRef.current !== requestVersion) {
        return;
      }

      if (result.status === "rate-limited") {
        setIsLoading(false);
        setIsRateLimitRedirecting(true);
        return;
      }

      if (result.status !== "success") {
        setAddressError(`住所検索に失敗しました: ${result.message}`);
        setIsLoading(false);
        return;
      }

      const sortedLocations = sortLocationsFromPosition(
        locations,
        result.position.lat,
        result.position.lng,
      );
      setDisplayedLocations(sortedLocations);
      setIsDistanceSorted(true);
      setStatusMessage("距離の近い順に施設を表示しています。");
      setIsLoading(false);
    } catch {
      if (requestVersionRef.current !== requestVersion) {
        return;
      }

      setAddressError(
        "住所検索に失敗しました。入力内容を確認してもう一度お試しください。",
      );
      setIsLoading(false);
    }
  };

  const renderLocationCard = (location: LocationPageLocation) => (
    <LocationCard
      key={location.id}
      location={location}
      areaName={location.areaName || "地域不明"}
    />
  );

  return (
    <>
      <div className="mb-8 space-y-4">
        <fieldset className="space-y-3" aria-busy={isLoading}>
          <legend className="text-lg font-semibold">
            距離順で施設を探す
          </legend>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLoading}
              aria-describedby={gpsError ? gpsErrorId : undefined}
              className="min-h-[44px] rounded-full border border-base-300 px-4 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content disabled:cursor-not-allowed"
            >
              現在地（GPS）から距離順に並べ替え
            </button>

            <form onSubmit={handleAddressSubmit} className="space-y-2">
              <label htmlFor={addressInputId} className="block text-base">
                住所または場所
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id={addressInputId}
                  name="address"
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  disabled={isLoading}
                  aria-invalid={addressError ? true : undefined}
                  aria-describedby={addressError ? addressErrorId : undefined}
                  placeholder="住所や場所名を入力"
                  className="min-h-[44px] w-full rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="min-h-[44px] rounded-full border border-base-300 px-4 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content disabled:cursor-not-allowed"
                >
                  住所を検索
                </button>
              </div>
              {addressError && (
                <p id={addressErrorId} role="alert" className="text-base">
                  {addressError}
                </p>
              )}
            </form>
          </div>
          {gpsError && (
            <p id={gpsErrorId} role="alert" className="text-base">
              {gpsError}
            </p>
          )}
          {statusMessage && (
            <p role="status" className="text-base">
              {statusMessage}
            </p>
          )}
        </fieldset>
        {isRateLimitRedirecting && <RateLimitRedirect />}
      </div>

      {displayedLocations.length === 0 ? (
        <p>該当する施設はありません</p>
      ) : isDistanceSorted ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayedLocations.map(renderLocationCard)}
        </div>
      ) : (
        <div>
          {groupLocationsByArea(displayedLocations).map(
            ([areaName, areaLocations]) => (
              <section key={areaName} className="mb-6">
                <h2 className="my-3 border-b border-base-300 pb-1 text-lg font-semibold">
                  {areaName}
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {areaLocations.map(renderLocationCard)}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </>
  );
}
