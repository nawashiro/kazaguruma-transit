"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  parseLocationOrigin,
  serializeLocationOrigin,
  type LocationCoordinates,
} from "@/lib/location/location-origin-query";

const LOCATION_URL_BASE = "https://kazaguruma.invalid";
const PERMISSION_DENIED_CODE = 1;
const TIMEOUT_CODE = 3;

function pathnameOnly(pathname: string | null): string {
  if (!pathname) {
    return "/";
  }

  return new URL(pathname, LOCATION_URL_BASE).pathname || "/";
}

function isLocationCategoryPath(pathname: string | null): boolean {
  const normalizedPathname = pathnameOnly(pathname).replace(/\/+$/, "") || "/";
  return /^\/locations\/[^/]+$/.test(normalizedPathname);
}

function buildDistanceHref(
  pathname: string | null,
  coordinates: LocationCoordinates,
): string {
  const url = new URL(pathnameOnly(pathname), LOCATION_URL_BASE);
  url.searchParams.set("origin", serializeLocationOrigin(coordinates));
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function geolocationErrorMessage(
  error: GeolocationPositionError | null | undefined,
): string {
  if (error?.code === PERMISSION_DENIED_CODE) {
    return "位置情報の利用が許可されませんでした。GPSの権限を確認してください。";
  }

  if (error?.code === TIMEOUT_CODE) {
    return "位置情報の取得がタイムアウトしました。もう一度お試しください。";
  }

  return "位置情報を取得できませんでした。GPSを確認してください。";
}

const UNSUPPORTED_GEOLOCATION_MESSAGE =
  "お使いのブラウザではGPSによる位置情報の取得に対応していません。";
const INVALID_COORDINATES_MESSAGE =
  "GPSから有効な座標を取得できませんでした。";
const INVALID_ORIGIN_MESSAGE =
  "originの座標を解釈できません。町字で表示します。";

export default function LocationSortControls() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  if (!isLocationCategoryPath(pathname)) {
    return null;
  }

  const parsedOrigin = parseLocationOrigin(searchParams?.get("origin"));
  const isDistanceMode = parsedOrigin.originState === "valid";
  const originError =
    parsedOrigin.originState === "invalid" ? INVALID_ORIGIN_MESSAGE : null;
  const errorMessage = gpsError ?? originError;

  const handleDistanceSort = () => {
    setIsLocating(true);
    setGpsError(null);

    const geolocation = navigator.geolocation;
    if (
      !geolocation ||
      typeof geolocation.getCurrentPosition !== "function"
    ) {
      setIsLocating(false);
      setGpsError(UNSUPPORTED_GEOLOCATION_MESSAGE);
      return;
    }

    try {
      geolocation.getCurrentPosition(
        (position) => {
          const latitude = position?.coords?.latitude;
          const longitude = position?.coords?.longitude;

          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            setIsLocating(false);
            setGpsError(INVALID_COORDINATES_MESSAGE);
            return;
          }

          const coordinates: LocationCoordinates = {
            lat: latitude,
            lng: longitude,
          };
          const href = buildDistanceHref(pathname, coordinates);
          setIsLocating(false);
          setGpsError(null);
          router.replace(href);
        },
        (error) => {
          setIsLocating(false);
          setGpsError(geolocationErrorMessage(error));
        },
      );
    } catch {
      setIsLocating(false);
      setGpsError(geolocationErrorMessage(undefined));
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <Link
        href={pathnameOnly(pathname)}
        className="btn text-base gap-0 min-h-[44px] min-w-[44px] flex-1"
        aria-current={isDistanceMode ? undefined : "page"}
      >
        町字で並べる
      </Link>
      <button
        type="button"
        className="btn text-base gap-0 min-h-[44px] min-w-[44px] flex-1"
        aria-pressed={isDistanceMode}
        disabled={isLocating}
        onClick={handleDistanceSort}
      >
        近い順に並べる
      </button>
      {isLocating && (
        <p role="status" aria-live="polite" className="sm:self-center">
          位置情報を取得中...
        </p>
      )}
      {errorMessage && (
        <p role="alert" aria-live="assertive" className="sm:self-center">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
