"use client";

import { useRouter } from "next/navigation";
import type { KeyLocation } from "@/utils/addressLoader";
import { convertToLocation } from "@/utils/addressLoader";

export interface LocationDetailContentProps {
  location: KeyLocation;
  areaName: string | null;
  onGoToLocation?: (location: KeyLocation) => void;
}

function DestinationButton({
  location,
  onGoToLocation,
}: {
  location: KeyLocation;
  onGoToLocation: (location: KeyLocation) => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-primary inline rounded-full dark:rounded-sm min-h-[44px] h-fit"
      onClick={() => onGoToLocation(location)}
    >
      <span className="ruby-text">ここへ行く</span>
    </button>
  );
}

function RoutedDestinationButton({ location }: { location: KeyLocation }) {
  const router = useRouter();

  return (
    <DestinationButton
      location={location}
      onGoToLocation={(target) => {
        const locationObject = convertToLocation(target);
        router.push(
          `/?destination=${encodeURIComponent(JSON.stringify(locationObject))}`,
        );
      }}
    />
  );
}

/** Displays location details without dialog lifecycle or focus management. */
export default function LocationDetailContent({
  location,
  areaName,
  onGoToLocation,
}: LocationDetailContentProps) {
  return (
    <section className="space-y-4" aria-labelledby="location-detail-content-title">
      <h2 id="location-detail-content-title" className="text-xl font-bold">
        {location.name}
      </h2>

      {areaName && <p className="text-sm /60">{areaName}</p>}

      {location.imageUri && (
        <figure className="relative h-64 w-full overflow-hidden">
          <img
            src={location.imageUri}
            alt={location.name}
            className="object-cover w-full h-full"
          />
        </figure>
      )}

      {location.description && (
        <div className="mt-4 ruby-text">
          <h3 className="font-semibold text-lg mb-2">説明</h3>
          <p className="text-sm">{location.description}</p>
        </div>
      )}

      {location.uri && (
        <p className="mt-4">
          <a
            href={location.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="link ruby-text"
          >
            ウェブサイトを見る
          </a>
        </p>
      )}

      <div className="mt-6 bg-base-100 p-3 rounded-lg ruby-text">
        <h3 className="font-semibold text-sm mb-2">提供情報</h3>
        <div className="space-y-2 text-sm">
          <p>座標データ提供: {location.nodeCopyright}</p>
          {location.imageCopyright && <p>画像提供: {location.imageCopyright}</p>}
          {location.description && location.descriptionCopyright && (
            <p>説明文提供: {location.descriptionCopyright}</p>
          )}
          <p>
            ライセンス:
            <a
              href={location.licenceUri}
              target="_blank"
              rel="noopener noreferrer"
              className="link ml-1"
            >
              {location.licence}
            </a>
          </p>
        </div>
      </div>

      <div className="mt-4">
        {onGoToLocation ? (
          <DestinationButton location={location} onGoToLocation={onGoToLocation} />
        ) : (
          <RoutedDestinationButton location={location} />
        )}
      </div>
    </section>
  );
}
