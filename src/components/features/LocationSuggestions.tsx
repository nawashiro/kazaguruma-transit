"use client";

import { memo } from "react";
import { Location } from "@/types/core";
import type { RouteDestinationCategory } from "@/types/route-destinations";
import { convertToLocation } from "@/utils/addressLoader";
import RubyWrapper from "@/components/ui/RubyWrapper";
import { WalkDistance, WalkWarning } from "./WalkDistance";

interface LocationSuggestionsProps {
  categories?: RouteDestinationCategory[];
  onLocationSelected: (location: Location) => void;
}

function LocationSuggestions({
  categories = [],
  onLocationSelected,
}: LocationSuggestionsProps) {
  return (
    <div className="min-w-0 text-base">
      <h3 className="text-lg font-bold ruby-text my-4">
        よく利用される施設から選択
      </h3>
      <div className="space-y-2 min-w-0">
        {categories.map((category) => (
          <details key={category.categoryId} name="facility-categories" className="collapse collapse-arrow bg-base-100 border border-base-300">
            <summary className="collapse-title">{category.category}</summary>
            <div className="collapse-content">
              <ul className="w-full min-w-0 space-y-1">
                {category.locations.map((location) => (
                  <li key={location.name} className="min-w-0">
                    <button
                      type="button"
                      className="min-h-[44px] w-full min-w-0 p-2 text-start text-base whitespace-normal break-words rounded-box hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2"
                      onClick={() => onLocationSelected(convertToLocation(location))}
                    >
                      {location.name}
                      <span className="ml-2 inline-block">
                        <WalkDistance walkMeters={location.walkMeters} />
                      </span>
                      <span className="ml-2 inline-block">
                        <WalkWarning walkMeters={location.walkMeters} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
      <RubyWrapper />
    </div>
  );
}

export default memo(LocationSuggestions);
