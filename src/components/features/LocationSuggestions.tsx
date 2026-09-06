"use client";

import { ChangeEvent, memo, useEffect, useId, useState } from "react";
import { CircleAlert } from "lucide-react";
import type { Location } from "@/types/core";
import type { LocationSuggestionCategory } from "@/types/location-pages";
import { loadAddressData, type AddressCategory } from "@/utils/addressLoader";

interface LocationSuggestionsProps {
  onLocationSelected: (location: Location) => void;
  suggestionCategories?: LocationSuggestionCategory[];
}

function convertLegacyCategories(
  categories: AddressCategory[],
): LocationSuggestionCategory[] {
  return categories.map((category) => ({
    categoryName: category.category,
    locations: category.locations.map(({ name, lat, lng }) => ({
      name,
      lat,
      lng,
    })),
  }));
}

function LocationSuggestions({
  onLocationSelected,
  suggestionCategories,
}: LocationSuggestionsProps) {
  const hasProvidedCategories = suggestionCategories !== undefined;
  const [categories, setCategories] = useState<LocationSuggestionCategory[]>(
    () => suggestionCategories ?? [],
  );
  const [loading, setLoading] = useState(!hasProvidedCategories);
  const [error, setError] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState("");
  const uniqueId = useId();
  const selectId = `location-suggestion-${uniqueId}`;

  useEffect(() => {
    if (suggestionCategories !== undefined) {
      setCategories(suggestionCategories);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    void loadAddressData()
      .then((loadedCategories) => {
        if (!isMounted) return;
        setCategories(convertLegacyCategories(loadedCategories));
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!isMounted) return;
        setError("住所データの読み込みに失敗しました");
        // Keep the component-local error boundary; no form navigation is
        // attempted when the optional legacy standalone loader fails.
        void loadError;
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [suggestionCategories]);

  const handleSelection = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedValue(value);
    if (!value) return;

    const locations = categories.flatMap((category) => category.locations);
    const selectedLocation = locations[event.target.selectedIndex];

    if (!selectedLocation) return;

    onLocationSelected({
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      address: selectedLocation.name,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center" aria-live="polite" aria-busy="true">
        <span
          className="loading loading-spinner loading-lg text-primary"
          aria-hidden="true"
        />
        <p className="ml-3 text-lg font-medium">施設データを読み込み中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="alert alert-error alert-soft text-base-content!"
        role="alert"
        aria-live="assertive"
      >
        <CircleAlert
          className="stroke-current shrink-0 h-6 w-6"
          aria-hidden="true"
        />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-base font-bold ruby-text my-4">
        よく利用される施設から選択
      </h3>
      <label htmlFor={selectId} className="label">
        <span className="label-text ruby-text">施設候補</span>
      </label>
      <select
        id={selectId}
        name="destination-suggestion"
        value={selectedValue}
        onChange={handleSelection}
        className="select min-h-[44px] w-full text-base"
        data-testid="location-suggestions-select"
      >
        {categories.map((category) => (
          <optgroup key={category.categoryName} label={category.categoryName}>
            {category.locations.map((location, index) => (
              <option
                key={`${category.categoryName}-${index}-${location.lat},${location.lng}`}
                value={`${location.lat},${location.lng}`}
              >
                {location.name}
              </option>
            ))}
          </optgroup>
        ))}
        <option value="">施設を選択してください</option>
      </select>
    </div>
  );
}

export default memo(LocationSuggestions);
