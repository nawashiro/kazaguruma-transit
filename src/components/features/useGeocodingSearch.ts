"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Location } from "@/types/core";
import { searchGeocoding } from "@/lib/location/geocoding-search";

export function useGeocodingSearch(onSelected: (location: Location) => void) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestGenerationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestGenerationRef.current += 1;
    };
  }, []);

  const search = useCallback(
    async (address: string): Promise<boolean> => {
      const requestGeneration = ++requestGenerationRef.current;
      const isCurrentRequest = () =>
        mountedRef.current &&
        requestGenerationRef.current === requestGeneration;

      if (!mountedRef.current) return false;

      setLoading(true);
      setError(null);

      try {
        const result = await searchGeocoding(address);

        if (!isCurrentRequest()) return false;

        if (result.isRateLimited) {
          router.push("/rate-limit?source=home");
          return false;
        }

        if (result.location) {
          onSelected(result.location);
          return true;
        }

        setError(result.error ?? "ジオコーディングに失敗しました");
        return false;
      } catch (error) {
        if (!isCurrentRequest()) return false;

        setError(
          error instanceof Error
            ? error.message
            : "ネットワーク接続を確認して、再度お試しください。",
        );
        return false;
      } finally {
        if (isCurrentRequest()) setLoading(false);
      }
    },
    [onSelected, router],
  );

  return { error, setError, loading, setLoading, search };
}
