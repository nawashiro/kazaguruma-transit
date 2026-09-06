"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type Ref,
} from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/types/core";
import InputField from "@/components/ui/InputField";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { logger } from "@/utils/logger";
import { useGeocodingSearch } from "./useGeocodingSearch";
import { LocateFixed, Search } from "lucide-react";

export interface OriginSelectorProps {
  onOriginSelected: (location: Location) => void;
  embedded?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  initialAddress?: string;
  error?: string;
  onInputChange?: () => void;
  required?: boolean;
}

// The outer <form> is owned by RouteSearchForm; this selector has no nested form.
export default function OriginSelector({
  onOriginSelected,
  embedded = false,
  inputRef,
  initialAddress = "",
  error: externalError,
  onInputChange,
  required = !embedded,
}: OriginSelectorProps) {
  const router = useRouter();
  const [address, setAddress] = useState(initialAddress);
  const uniqueId = useId();
  const buttonGroupId = `origin-actions-${uniqueId}`;
  const mountedRef = useRef(true);
  const operationGenerationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      operationGenerationRef.current += 1;
    };
  }, []);

  const handleSelected = useCallback(
    (location: Location) => onOriginSelected(location),
    [onOriginSelected],
  );
  const {
    error: searchError,
    setError,
    loading,
    setLoading,
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

  const handleUseCurrentLocation = () => {
    const operationGeneration = ++operationGenerationRef.current;
    const isCurrentOperation = () =>
      mountedRef.current &&
      operationGenerationRef.current === operationGeneration;

    if (!mountedRef.current) return;

    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("お使いのブラウザではGPS機能に対応していません");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (!isCurrentOperation()) return;

        try {
          const location: Location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          try {
            const response = await fetch(
              `/api/geocode?address=${location.lat},${location.lng}`,
            );
            const data = (await response.json()) as {
              limitExceeded?: boolean;
              success?: boolean;
              results?: Array<{ formattedAddress?: string }>;
            };
            logger.log("Reverse Geocode API Response:", data);

            if (!isCurrentOperation()) return;

            if (response.status === 429 && data.limitExceeded) {
              router.push("/rate-limit?source=home");
              return;
            }

            if (response.ok && data.success && data.results?.length) {
              const formattedAddress = data.results[0]?.formattedAddress;
              if (formattedAddress) location.address = formattedAddress;
            }
          } catch (error) {
            logger.error("逆ジオコーディングエラー:", error);
            // Reverse geocoding is optional; coordinates remain usable.
          }

          if (!isCurrentOperation()) return;
          onOriginSelected(location);
        } catch (error) {
          if (!isCurrentOperation()) return;

          setError(
            error instanceof Error
              ? error.message
              : "予期せぬエラーが発生しました",
          );
        } finally {
          if (isCurrentOperation()) setLoading(false);
        }
      },
      (geolocationError) => {
        if (!isCurrentOperation()) return;

        setError(
          "位置情報の取得に失敗しました: " + geolocationError.message,
        );
        setLoading(false);
      },
    );
  };

  const content = (
    <>
      <h3 className="text-base font-bold ruby-text">名前で検索</h3>
      <InputField
        ref={inputRef}
        label="出発地"
        placeholder="千代田区役所"
        value={address}
        onChange={handleAddressChange}
        onKeyDown={handleAddressKeyDown}
        disabled={loading}
        testId="address-input"
        required={required}
        error={displayedError || undefined}
        description="千代田区内の住所や場所名を入力してください。自動的に「千代田区」が先頭に追加されます。"
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
            aria-label="住所や場所を検索"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Button>
        }
      />

      <fieldset aria-describedby={buttonGroupId} className="mt-4">
        <legend id={buttonGroupId} className="sr-only">
          検索オプション
        </legend>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={loading}
            loading={loading}
            className="flex-1"
            testId="gps-button"
            aria-label="端末のGPSを許可する"
          >
            <LocateFixed
              className="mr-2 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            端末のGPSを許可する
          </Button>
        </div>
      </fieldset>
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Card testId="origin-selector-card" title="出発地を選択してください">
      <div className="space-y-4">{content}</div>
    </Card>
  );
}
