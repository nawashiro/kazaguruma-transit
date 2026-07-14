"use client";

import { useState, useCallback } from "react";
import { Location } from "@/types/core";
import LocationSuggestions from "./LocationSuggestions";
import InputField from "@/components/ui/InputField";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useGeocodingSearch } from "./useGeocodingSearch";
import RateLimitModal from "./RateLimitModal";
import { FiSearch } from "react-icons/fi";

interface DestinationSelectorProps {
  onDestinationSelected: (location: Location) => void;
}

export default function DestinationSelector({
  onDestinationSelected,
}: DestinationSelectorProps) {
  const [address, setAddress] = useState("");
  const handleSelected = useCallback((location: Location) => onDestinationSelected(location), [onDestinationSelected]);
  const { error, loading, isRateLimitModalOpen, setIsRateLimitModalOpen, search } = useGeocodingSearch(handleSelected);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await search(address);
  };

  const handleLocationSelected = (location: Location) => {
    onDestinationSelected(location);
  };

  return (
    <>
      <Card title="目的地を選択してください" className="mb-6">
        <LocationSuggestions onLocationSelected={handleLocationSelected} />

        <div className="divider">または</div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-base font-bold ruby-text">名前で検索</h3>
          <InputField
            placeholder="神田駿河台"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={loading}
            testId="address-input"
            required={false}
            error={error || undefined}
            description="千代田区内の住所や場所名を入力してください。建物名だけでも大丈夫な場合がほとんどです。"
            endAdornment={
              <Button
                type="submit"
                disabled={loading}
                loading={loading}
                iconOnly
                joined
                className="join-item h-11 w-11 p-0 focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-base-content"
                testId="search-button"
                aria-label="目的地の住所や場所を検索"
              >
                <FiSearch className="h-5 w-5" aria-hidden="true" />
              </Button>
            }
          />
        </form>
      </Card>

      {/* レート制限モーダル */}
      <RateLimitModal
        isOpen={isRateLimitModalOpen}
        onClose={() => setIsRateLimitModalOpen(false)}
      />
    </>
  );
}
