"use client";

import { useState, useId, memo } from "react";
import { MapPin } from "lucide-react";
import { Location } from "@/types/core";
import type { AddressCategory, AddressLocation } from "@/utils/addressLoader";
import { convertToLocation } from "@/utils/addressLoader";
import RubyWrapper from "@/components/ui/RubyWrapper";
import CategoryTabs from "@/components/ui/CategoryTabs";

interface LocationSuggestionsProps {
  categories?: AddressCategory[];
  onLocationSelected: (location: Location) => void;
}

function LocationSuggestions({
  categories = [],
  onLocationSelected,
}: LocationSuggestionsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const uniqueId = useId();
  const categoryListId = `category-list-${uniqueId}`;
  const locationListId = `location-list-${uniqueId}`;
  const sectionId = `location-section-${uniqueId}`;

  const handleLocationSelect = (location: AddressLocation) => {
    onLocationSelected(convertToLocation(location));
  };

  const toggleCategory = (category: string) => {
    if (activeCategory === category) {
      setActiveCategory(null);
    } else {
      setActiveCategory(category);
    }
  };

  return (
    <div data-testid={sectionId}>
      <h3
        className="text-base font-bold ruby-text my-4"
      >
        よく利用される施設から選択
      </h3>
      <CategoryTabs
        categories={categories.map((category) => category.category)}
        activeCategory={activeCategory}
        onCategoryChange={toggleCategory}
        idPrefix={categoryListId}
        activePanelId={locationListId}
        ariaLabel="施設カテゴリ"
      />

      {activeCategory && (
        <div
          className="bg-base-100 rounded-box p-3 animate-fadeIn max-h-64 overflow-y-auto"
          role="tabpanel"
          id={locationListId}
          aria-labelledby={`${categoryListId}-${activeCategory.replace(
            /\s+/g,
            "-"
          )}`}
        >
          <ul
            className="menu w-full"
            aria-label={`${activeCategory}の施設一覧`}
          >
            {categories
              .find((c) => c.category === activeCategory)!
              .locations.map((location) => (
                <li key={location.name}>
                  <button
                    type="button"
                    className="flex min-h-[44px] w-full items-center text-start text-base"
                    onClick={() => handleLocationSelect(location)}
                  >
                    <div className="flex items-center w-full overflow-hidden">
                      <MapPin className="h-4 w-4 mr-2 flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{location.name}</span>
                    </div>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}</style>

      <RubyWrapper />
    </div>
  );
}

export default memo(LocationSuggestions);
