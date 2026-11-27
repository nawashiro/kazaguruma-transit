import PageHeader from "@/components/layouts/PageHeader";
import HomeRouteForm from "@/components/features/HomeRouteForm";
import {
  readLocationArtifact,
  type LocationArtifactReadResult,
} from "@/lib/location/location-artifact";
import type { RouteDestinationCategory } from "@/types/route-destinations";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSerializableValue(
  value: unknown,
  ancestors: Set<object> = new Set(),
): boolean {
  if (value === null) {
    return true;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value !== "object" || ancestors.has(value)) {
    return false;
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);

  if (Array.isArray(value)) {
    return value.every((item) => isSerializableValue(item, nextAncestors));
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  return Object.values(value).every((item) =>
    isSerializableValue(item, nextAncestors),
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRouteDestinations(
  value: unknown,
): value is RouteDestinationCategory[] {
  if (
    !isSerializableValue(value) ||
    !Array.isArray(value) ||
    value.length === 0
  ) {
    return false;
  }

  return value.every((category) => {
    if (
      !isRecord(category) ||
      !isNonEmptyString(category.category) ||
      !isNonEmptyString(category.categoryId) ||
      !Array.isArray(category.locations) ||
      category.locations.length === 0
    ) {
      return false;
    }

    return category.locations.every(
      (location) =>
        isRecord(location) &&
        isNonEmptyString(location.name) &&
        typeof location.lat === "number" &&
        Number.isFinite(location.lat) &&
        typeof location.lng === "number" &&
        Number.isFinite(location.lng) &&
        (location.walkMeters === undefined ||
          (typeof location.walkMeters === "number" &&
            Number.isInteger(location.walkMeters) &&
            location.walkMeters >= 0)),
    );
  });
}

function getRouteDestinations(
  result: LocationArtifactReadResult,
): RouteDestinationCategory[] | null {
  if (result.status !== "success") {
    return null;
  }

  const artifact: unknown = result.artifact;
  if (!isRecord(artifact) || !isRecord(artifact.sources)) {
    return null;
  }

  const routeDestinations: unknown = artifact.sources.routeDestinations;
  return isRouteDestinations(routeDestinations) ? routeDestinations : null;
}

function HomeDataError() {
  return (
    <div>
      <PageHeader
        title={
          <>
            <ruby>風<rt>かざ</rt></ruby>ぐるま乗換案内
          </>
        }
        description="千代田区地域福祉交通「風ぐるま」の自動案内サイト"
      />
      <div
        className="alert alert-error alert-soft text-base-content!"
        role="alert"
      >
        <p>施設データの読み込みに失敗しました。時間をおいて再試行してください。</p>
      </div>
    </div>
  );
}

export default function Home() {
  let result: LocationArtifactReadResult;

  try {
    result = readLocationArtifact();
  } catch {
    return <HomeDataError />;
  }

  const routeDestinations = getRouteDestinations(result);
  if (routeDestinations === null) {
    return <HomeDataError />;
  }

  return <HomeRouteForm routeDestinations={routeDestinations} />;
}
