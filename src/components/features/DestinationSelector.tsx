"use client";

import { useCallback, useState, type Ref } from "react";
import type { Location } from "@/types/core";
import type { LocationSuggestionCategory } from "@/types/location-pages";
import LocationSuggestions from "./LocationSuggestions";
import InputField from "@/components/ui/InputField";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useGeocodingSearch } from "./useGeocodingSearch";
import { Search } from "lucide-react";

export interface DestinationSelectorProps {
  onDestinationSelected: (location: Location) => void;
  suggestionCategories?: LocationSuggestionCategory[];
  embedded?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  initialAddress?: string;
  error?: string;
  onInputChange?: () => void;
}

// The outer <form> is owned by RouteSearchForm; this selector has no nested form.
export default function DestinationSelector({
  onDestinationSelected,
  suggestionCategories,
  embedded = false,
  inputRef,
  initialAddress = "",
  error: externalError,
  onInputChange,
}: DestinationSelectorProps) {
  const [address, setAddress] = useState(initialAddress);
  const handleSelected = useCallback(
    (location: Location) => onDestinationSelected(location),
    [onDestinationSelected],
  );
  const {
    error: searchError,
    setError,
    loading,
    search,
  } = useGeocodingSearch(handleSelected);
  const displayedError = searchError ?? externalError;

  const handleAddressSearch = () => {
    void search(address);
  };

  const handleAddressKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleAddressSearch();
  };

  const handleAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(event.target.value);
    setError(null);
    onInputChange?.();
  };

  const content = (
    <>
      <LocationSuggestions
        onLocationSelected={handleSelected}
        suggestionCategories={suggestionCategories}
      />

      <div className="divider">または</div>

      <div className="space-y-4">
        <h3 className="text-base font-bold ruby-text">名前で検索</h3>
        <InputField
          ref={inputRef}
          label="目的地"
          placeholder="神田駿河台"
          value={address}
          onChange={handleAddressChange}
          onKeyDown={handleAddressKeyDown}
          disabled={loading}
          testId="address-input"
          required={false}
          error={displayedError || undefined}
          description="千代田区内の住所や場所名を入力してください。建物名だけでも大丈夫な場合がほとんどです。"
          endAdornment={
            <Button
              type="button"
              onClick={handleAddressSearch}
              disabled={loading}
              loading={loading}
              iconOnly
              joined
              className="join-item h-11 w-11 p-0 focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-base-content"
              testId="search-button"
              aria-label="目的地の住所や場所を検索"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Button>
          }
        />
      </div>
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Card title="目的地を選択してください" className="mb-6">
      <div className="space-y-4">{content}</div>
    </Card>
  );
}
