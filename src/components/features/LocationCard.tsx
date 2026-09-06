import Link from "next/link";
import type { KeyLocation } from "@/utils/addressLoader";
import type { LocationPageLocation } from "@/types/location-pages";

export interface LocationCardProps {
  location: KeyLocation | LocationPageLocation;
  areaName?: string | null;
}

function getPrecomputedAreaName(
  location: KeyLocation | LocationPageLocation,
): string | null {
  if (
    "areaName" in location &&
    typeof location.areaName === "string" &&
    location.areaName.length > 0
  ) {
    return location.areaName;
  }

  return null;
}

/** 事前計算済みの地域名を表示する、状態を持たない施設カード。 */
export default function LocationCard({ location, areaName }: LocationCardProps) {
  const displayedAreaName =
    (typeof areaName === "string" && areaName.length > 0
      ? areaName
      : getPrecomputedAreaName(location)) ?? "地域不明";
  const detailHref = `/locations/location-detail/${encodeURIComponent(location.id)}`;

  return (
    <Link
      href={detailHref}
      className="card cursor-pointer bg-base-100 shadow-sm hover:shadow-lg transition-all w-full h-fit"
    >
      {location.imageUri && (
        <figure className="relative">
          <img
            src={location.imageUri}
            alt={location.name}
            className="object-cover h-48 w-full"
            style={{ width: "100%", height: "192px", objectFit: "cover" }}
          />
        </figure>
      )}

      <div className="card-body text-left">
        <h2 className="card-title inline gap-0">{location.name}</h2>
        <p className="text-base">{displayedAreaName}</p>

        {location.description && (
          <p className="text-base mt-1 inline ruby-text">{location.description}</p>
        )}
      </div>
    </Link>
  );
}
