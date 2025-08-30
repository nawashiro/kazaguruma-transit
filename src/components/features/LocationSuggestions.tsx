"use client";

import { useState, useEffect, useId, memo } from "react";
import { Location } from "@/types/core";
import {
  AddressCategory,
  AddressLocation,
  loadAddressData,
  convertToLocation,
} from "@/utils/addressLoader";
import { logger } from "@/utils/logger";
import Card from "@/components/ui/Card";

interface LocationSuggestionsProps {
  onLocationSelected: (location: Location) => void;
  onLoadingChange?: (loading: boolean) => void;
}

function LocationSuggestions({
  onLocationSelected,
  onLoadingChange,
}: LocationSuggestionsProps) {
  const [categories, setCategories] = useState<AddressCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const uniqueId = useId();
  const categoryListId = `category-list-${uniqueId}`;
  const locationListId = `location-list-${uniqueId}`;
  const sectionId = `location-section-${uniqueId}`;

  useEffect(() => {
    async function fetchAddressData() {
      try {
        setLoading(true);
        onLoadingChange?.(true);
        const data = await loadAddressData();
        setCategories(data);
        setError(null);
      } catch (err) {
        setError("住所データの読み込みに失敗しました");
        logger.error(err);
      } finally {
        setLoading(false);
        onLoadingChange?.(false);
      }
    }

    fetchAddressData();
  }, [onLoadingChange]);

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


  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        aria-live="polite"
        aria-busy="true"
      >
        <span
          className="loading loading-spinner loading-lg text-primary"
          aria-hidden="true"
        ></span>
        <p className="ml-3 text-lg font-medium">施設データを読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mb-6 overflow-hidden">
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      </Card>
    );
  }

  return (
    <div data-testid={sectionId}>
      <label
        htmlFor={categoryListId}
        className="label label-text font-medium text-foreground ruby-text inline"
      >
        よく利用される施設から選択
      </label>
      <div
        className="flex flex-row flex-wrap gap-2 mb-4 mt-2"
        role="tablist"
        id={categoryListId}
        aria-label="施設カテゴリ"
      >
        {categories.map((category) => {
          const isActive = activeCategory === category.category;
          const categoryId = `category-${category.category.replace(
            /\s+/g,
            "-"
          )}`;
          const controlsId = isActive ? locationListId : undefined;

          return (
            <button
              key={category.category}
              id={categoryId}
              className={`btn border px-2 py-1 h-auto min-h-0 rounded-md justify-start font-medium ruby-text
                ${
                  isActive
                    ? "btn-primary border-primary text-primary-content"
                    : "btn-outline hover:border-primary/50 hover:bg-primary/5"
                }
              `}
              onClick={() => toggleCategory(category.category)}
              role="tab"
              aria-selected={isActive}
              aria-controls={controlsId}
              aria-label={`${category.category}カテゴリを${
                isActive ? "閉じる" : "開く"
              }`}
            >
              <p>{category.category}</p>
            </button>
          );
        })}
      </div>

      {activeCategory && (
        <div
          className="bg-base-100 rounded-box p-3 animate-fadeIn max-h-64 overflow-y-auto"
          role="tabpanel"
          aria-labelledby={`category-${activeCategory.replace(/\s+/g, "-")}`}
        >
          <ul
            className="menu w-full"
            id={locationListId}
            aria-label={`${activeCategory}の施設一覧`}
          >
            {categories
              .find((c) => c.category === activeCategory)!
              .locations.map((location) => (
                <li key={location.name}>
                  <button onClick={() => handleLocationSelect(location)}>
                    <div className="flex items-center w-full overflow-hidden">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-2 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
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
    </div>
  );
}

export default memo(LocationSuggestions);
