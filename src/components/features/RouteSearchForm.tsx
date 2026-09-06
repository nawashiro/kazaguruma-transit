"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import DateTimeSelector from "@/components/features/DateTimeSelector";
import DestinationSelector from "@/components/features/DestinationSelector";
import OriginSelector from "@/components/features/OriginSelector";
import type { Location } from "@/types/core";
import type { LocationSuggestionCategory } from "@/types/location-pages";
import {
  buildRouteResultsUrl,
  parseRouteInputSearchParams,
} from "@/lib/transit/route-search-query";

type LocationField = "origin" | "destination";
type FormField =
  | "origin"
  | "destination"
  | "time"
  | "isDeparture"
  | "prioritizeSpeed";
type FormErrors = Partial<Record<FormField, string>>;

export interface RouteSearchFormProps {
  suggestionCategories?: LocationSuggestionCategory[];
}

function getCurrentLocalDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatLocation(location: Location): string {
  return (
    location.address ||
    `緯度: ${location.lat.toFixed(6)}, 経度: ${location.lng.toFixed(6)}`
  );
}

export function RouteSearchForm({
  suggestionCategories,
}: RouteSearchFormProps) {
  const router = useRouter();
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [dateTime, setDateTime] = useState("");
  const [isDeparture, setIsDeparture] = useState(true);
  const [prioritizeSpeed, setPrioritizeSpeed] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [editingLocation, setEditingLocation] = useState<LocationField | null>(
    null,
  );
  const originInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const parsed = parseRouteInputSearchParams(searchParams);
    const storedPriority = localStorage.getItem("prioritizeSpeed") === "true";
    const hasTimeParameter = searchParams.has("time");

    setOrigin(parsed.values.origin ?? null);
    setDestination(parsed.values.destination ?? null);
    setDateTime(
      parsed.values.time ??
        (hasTimeParameter ? "" : getCurrentLocalDateTime()),
    );
    setIsDeparture(parsed.values.isDeparture ?? true);
    setPrioritizeSpeed(parsed.values.prioritizeSpeed ?? storedPriority);
    setErrors(parsed.errors);
  }, []);

  useEffect(() => {
    if (editingLocation === "origin") {
      originInputRef.current?.focus();
    }
    if (editingLocation === "destination") {
      destinationInputRef.current?.focus();
    }
  }, [editingLocation]);

  const clearError = (field: FormField) => {
    setErrors((currentErrors) => {
      if (!(field in currentErrors)) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleOriginSelected = (location: Location) => {
    setOrigin(location);
    setEditingLocation((current) =>
      current === "origin" ? null : current,
    );
    clearError("origin");
  };

  const handleDestinationSelected = (location: Location) => {
    setDestination(location);
    setEditingLocation((current) =>
      current === "destination" ? null : current,
    );
    clearError("destination");
  };

  const handleDateTimeChange = (value: string) => {
    setDateTime(value);
    clearError("time");
  };

  const handleDepartureChange = (value: boolean) => {
    setIsDeparture(value);
    clearError("isDeparture");
  };

  const handlePriorityChange = (value: boolean) => {
    setPrioritizeSpeed(value);
    clearError("prioritizeSpeed");
    localStorage.setItem("prioritizeSpeed", String(value));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FormErrors = { ...errors };

    if (!destination) {
      nextErrors.destination = "目的地を入力または選択してください。";
    }
    if (!origin) {
      nextErrors.origin = "出発地を入力または選択してください。";
    }
    if (!dateTime) {
      nextErrors.time = "日時を入力してください。";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!origin || !destination || !dateTime) return;

    router.push(
      buildRouteResultsUrl({
        origin,
        destination,
        time: dateTime,
        isDeparture,
        prioritizeSpeed,
      }),
    );
  };

  const destinationIsEditing = !destination || editingLocation === "destination";
  const originIsEditing = !origin || editingLocation === "origin";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
      aria-label="経路検索"
    >
      <fieldset className="space-y-4" aria-labelledby="destination-heading">
        <legend className="sr-only">目的地を選ぶ</legend>
        <h2 id="destination-heading" className="text-xl font-bold ruby-text">
          目的地を選ぶ
        </h2>
        {destinationIsEditing ? (
          <DestinationSelector
            embedded
            inputRef={destinationInputRef}
            initialAddress={destination?.address}
            error={errors.destination}
            onInputChange={() => clearError("destination")}
            onDestinationSelected={handleDestinationSelected}
            suggestionCategories={suggestionCategories}
          />
        ) : (
          <div className="space-y-2">
            <p data-testid="selected-destination">{formatLocation(destination)}</p>
            <Button
              type="button"
              onClick={() => setEditingLocation("destination")}
              aria-label="目的地をなおす"
            >
              なおす
            </Button>
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-4" aria-labelledby="origin-heading">
        <legend className="sr-only">出発地を選ぶ</legend>
        <h2 id="origin-heading" className="text-xl font-bold ruby-text">
          出発地を選ぶ
        </h2>
        {originIsEditing ? (
          <OriginSelector
            embedded
            inputRef={originInputRef}
            initialAddress={origin?.address}
            error={errors.origin}
            onInputChange={() => clearError("origin")}
            onOriginSelected={handleOriginSelected}
            required={false}
          />
        ) : (
          <div className="space-y-2">
            <p data-testid="selected-origin">{formatLocation(origin)}</p>
            <Button
              type="button"
              onClick={() => setEditingLocation("origin")}
              aria-label="出発地をなおす"
            >
              なおす
            </Button>
          </div>
        )}
      </fieldset>

      <section aria-labelledby="datetime-heading" className="space-y-4">
        <h2 id="datetime-heading" className="text-xl font-bold ruby-text">
          日時
        </h2>
        <DateTimeSelector
          value={dateTime}
          isDeparture={isDeparture}
          timeError={errors.time}
          departureError={errors.isDeparture}
          onValueChange={handleDateTimeChange}
          onDepartureChange={handleDepartureChange}
        />
      </section>

      <fieldset
        className="space-y-4"
        aria-labelledby="priority-heading"
        aria-describedby={errors.prioritizeSpeed ? "priority-error" : undefined}
      >
        <legend className="sr-only">スピードを選ぶ</legend>
        <h2 id="priority-heading" className="text-xl font-bold ruby-text">
          スピードを選ぶ
        </h2>
        <div className="space-y-2">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="prioritizeSpeed"
              value="false"
              className="radio"
              checked={!prioritizeSpeed}
              onChange={() => handlePriorityChange(false)}
            />
            <span className="ruby-text">歩きを最小限、ゆっくり行く</span>
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="prioritizeSpeed"
              value="true"
              className="radio"
              checked={prioritizeSpeed}
              onChange={() => handlePriorityChange(true)}
            />
            <span className="ruby-text">歩きを許可、はやく行く</span>
          </label>
        </div>
        {errors.prioritizeSpeed && (
          <div
            id="priority-error"
            className="text-base-content text-base font-medium leading-relaxed"
            role="alert"
          >
            {errors.prioritizeSpeed}
          </div>
        )}
      </fieldset>

      <Button type="submit" className="w-full">
        検索
      </Button>
    </form>
  );
}

export default RouteSearchForm;
