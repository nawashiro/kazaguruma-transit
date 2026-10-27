"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Location } from "@/types/core";
import Button from "@/components/ui/Button";

export interface LocationSelectionProps {
  selectedLocation?: Location | null;
  onEdit?: () => void;
  validationError?: string;
}

export default function LocationFieldset({
  label, selectedLocation, onEdit, children, testId,
}: LocationSelectionProps & { label: string; children: ReactNode; testId: string }) {
  const fieldset = useRef<HTMLFieldSetElement>(null);
  const previous = useRef(selectedLocation);
  const lastFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const active = document.activeElement;
    const focusStayedInGroup = fieldset.current?.contains(active)
      || (active === document.body && lastFocused.current !== null && !lastFocused.current.isConnected);
    if (previous.current !== selectedLocation && (!selectedLocation || focusStayedInGroup)) {
      fieldset.current?.querySelector<HTMLElement>(selectedLocation ? "[data-selected-location]" : "input")?.focus();
    }
    previous.current = selectedLocation;
  }, [selectedLocation]);

  return (
    <section className="min-w-0">
      <fieldset ref={fieldset} onFocusCapture={event => { lastFocused.current = event.target; }} className="fieldset min-w-0 w-full border border-base-300 rounded-box bg-base-200 p-4 text-base">
        <legend className="fieldset-legend text-base">{label}</legend>
        {selectedLocation ? (
          <>
            <p data-selected-location tabIndex={-1} data-testid={testId} className="min-w-0 break-words text-base focus-visible:outline-2 focus-visible:outline-offset-2">
              {selectedLocation.address || `緯度: ${selectedLocation.lat.toFixed(6)}, 経度: ${selectedLocation.lng.toFixed(6)}`}
            </p>
            <p className="min-w-0 text-base"><Button onClick={onEdit}>なおす</Button></p>
          </>
        ) : children}
      </fieldset>
    </section>
  );
}
