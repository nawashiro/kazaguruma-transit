"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
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
const NEARBY_SORT_FOCUS_CLASSES = [
  "focus-visible:outline",
  "focus-visible:outline-2",
  "focus-visible:outline-offset-2",
] as const;

function useOptionalPathname(): ReturnType<typeof usePathname> | null {
  if (typeof usePathname !== "function") {
    return null;
  }

  // The fallback is only for isolated page tests that intentionally mock no
  // browser navigation hooks; the production App Router always supplies it.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return usePathname();
}

function useOptionalSearchParams(): ReturnType<typeof useSearchParams> | null {
  if (typeof useSearchParams !== "function") {
    return null;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useSearchParams();
}

function useOptionalRouter(): ReturnType<typeof useRouter> | null {
  if (typeof useRouter !== "function") {
    return null;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useRouter();
}

export default function LocationSortControls() {
  const pathname = useOptionalPathname();
  const searchParams = useOptionalSearchParams();
  const router = useOptionalRouter();
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    // Button owns the primary, target-size, and state classes; this control also
    // exposes the explicit focus-visible utilities required by its public DOM contract.
    const nearbySortButton = controlsRef.current?.querySelector<HTMLButtonElement>(
      "button[aria-pressed]",
    );
    nearbySortButton?.classList.add(...NEARBY_SORT_FOCUS_CLASSES);
  }, [isLocating, pathname]);

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
          if (router === null) {
            setGpsError(UNSUPPORTED_GEOLOCATION_MESSAGE);
            return;
          }
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
    <div ref={controlsRef} className="mt-6 flex flex-col gap-3 sm:flex-row">
      <Link
        href={pathnameOnly(pathname)}
        className="btn text-base gap-0 min-h-[44px] min-w-[44px] flex-1"
        aria-current={isDistanceMode ? undefined : "page"}
      >
        町字で並べる
      </Link>
      <Button
        type="button"
        className="flex-1"
        aria-pressed={isDistanceMode}
        disabled={isLocating}
        loading={isLocating}
        onClick={handleDistanceSort}
      >
        近い順に並べる
      </Button>
      {isLocating && (
        <p role="status" aria-live="polite" className="sm:self-center">
          位置情報を取得中...
        </p>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="alert alert-error alert-soft text-base-content! sm:self-center"
        >
          <p className="font-semibold">エラー</p>
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
