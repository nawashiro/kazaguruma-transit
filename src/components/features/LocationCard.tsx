"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { KeyLocation } from "@/utils/addressLoader";
import { findLocationAreaName } from "@/lib/location/location-list-state";

export interface LocationCardProps {
  location: KeyLocation;
  areaName?: string | null;
}

/** A reusable summary card that navigates to the location detail route. */
export default function LocationCard({ location, areaName }: LocationCardProps) {
  const initialAreaName =
    areaName ?? (typeof location.area === "string" ? location.area : null);
  const [resolvedAreaName, setResolvedAreaName] = useState<string | null>(
    initialAreaName,
  );

  useEffect(() => {
    if (areaName !== undefined || initialAreaName !== null) {
      return;
    }

    let isCurrent = true;
    void findLocationAreaName({ lat: location.lat, lng: location.lng })
      .then((name) => {
        if (isCurrent) {
          setResolvedAreaName(name);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setResolvedAreaName("不明");
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [areaName, initialAreaName, location.lat, location.lng, location]);

  const displayedAreaName = areaName ?? resolvedAreaName;
  const detailHref = `/location-detail/${encodeURIComponent(location.id)}`;

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
        <h2 className="card-title">{location.name}</h2>

        {displayedAreaName && <p className="text-base">{displayedAreaName}</p>}

        {location.description && (
          <p className="text-base mt-1 inline ruby-text">{location.description}</p>
        )}
      </div>
    </Link>
  );
}
