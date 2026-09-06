"use client";

import React, { useEffect, useId, useState } from "react";
import { TransitFormData } from "@/types/core";

interface DateTimeSelectorProps {
  initialStopId?: string;
  onSubmit?: (formData: TransitFormData) => void;
  onDateTimeSelected?: (formData: TransitFormData) => void;
  disabled?: boolean;
  value?: string;
  isDeparture?: boolean;
  onValueChange?: (value: string) => void;
  onDepartureChange?: (isDeparture: boolean) => void;
  error?: string;
  timeError?: string;
  departureError?: string;
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

const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  initialStopId = "",
  onSubmit,
  onDateTimeSelected,
  disabled = false,
  value,
  isDeparture,
  onValueChange,
  onDepartureChange,
  error,
  timeError,
  departureError,
}) => {
  const [internalDateTime, setInternalDateTime] = useState("");
  const [internalIsDeparture, setInternalIsDeparture] = useState(true);
  const uniqueId = useId();
  const inputId = `time-input-${uniqueId}`;
  const legendId = `time-legend-${uniqueId}`;
  const descriptionId = `time-description-${uniqueId}`;
  const resolvedTimeError = timeError ?? error;
  const timeErrorId = resolvedTimeError
    ? `time-error-${uniqueId}`
    : undefined;
  const departureErrorId = departureError
    ? `departure-error-${uniqueId}`
    : undefined;
  const isDateTimeControlled = value !== undefined;
  const isDepartureControlled = isDeparture !== undefined;
  const dateTime = isDateTimeControlled ? value : internalDateTime;
  const departure = isDepartureControlled ? isDeparture : internalIsDeparture;
  const inputTestId = departure ? "departure-input" : "arrival-input";
  const labelTestId = departure ? "departure-label" : "arrival-label";
  const dateTimeDescribedBy =
    [descriptionId, timeErrorId].filter(Boolean).join(" ") || undefined;

  const notifyLegacyParent = (nextDateTime: string, nextDeparture: boolean) => {
    const formData: TransitFormData = {
      stopId: initialStopId,
      dateTime: nextDateTime,
      isDeparture: nextDeparture,
    };
    onSubmit?.(formData);
    onDateTimeSelected?.(formData);
  };

  useEffect(() => {
    if (isDateTimeControlled || internalDateTime) return;

    const initialDateTime = getCurrentLocalDateTime();
    setInternalDateTime(initialDateTime);
    notifyLegacyParent(initialDateTime, departure);
    // The legacy callback is intentionally called once while initializing the
    // uncontrolled component. Controlled parents receive explicit callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDateTimeControlled, internalDateTime, initialStopId, departure]);

  const handleDateTimeChange = (nextDateTime: string) => {
    if (!isDateTimeControlled) setInternalDateTime(nextDateTime);
    onValueChange?.(nextDateTime);
    notifyLegacyParent(nextDateTime, departure);
  };

  const handleDepartureChange = (nextDeparture: boolean) => {
    if (!isDepartureControlled) setInternalIsDeparture(nextDeparture);
    onDepartureChange?.(nextDeparture);
    notifyLegacyParent(dateTime, nextDeparture);
  };

  return (
    <div>
      <fieldset
        role="radiogroup"
        aria-labelledby={legendId}
        aria-describedby={departureErrorId}
      >
        <legend id={legendId} className="sr-only">
          日時
        </legend>
        <div className="space-y-2">
          <label
            htmlFor={`departure-radio-${uniqueId}`}
            className="flex min-h-[44px] cursor-pointer items-center gap-2"
          >
            <input
              id={`departure-radio-${uniqueId}`}
              name={`time-type-${uniqueId}`}
              type="radio"
              className="radio"
              checked={departure}
              onChange={() => handleDepartureChange(true)}
              data-testid="departure-radio"
              disabled={disabled}
            />
            <span className="ruby-text">出発時刻</span>
          </label>
          <label
            htmlFor={`arrival-radio-${uniqueId}`}
            className="flex min-h-[44px] cursor-pointer items-center gap-2"
          >
            <input
              id={`arrival-radio-${uniqueId}`}
              name={`time-type-${uniqueId}`}
              type="radio"
              className="radio"
              checked={!departure}
              onChange={() => handleDepartureChange(false)}
              data-testid="arrival-radio"
              disabled={disabled}
            />
            <span className="ruby-text">到着時刻</span>
          </label>
        </div>
        {departureError && (
          <div
            id={departureErrorId}
            className="text-base-content text-base font-medium leading-relaxed"
            role="alert"
          >
            {departureError}
          </div>
        )}
      </fieldset>

      <div className="form-control mt-4">
        <label htmlFor={inputId} className="label">
          <span
            className="label-text font-medium mr-2 ruby-text"
            data-testid={labelTestId}
          >
            日時
          </span>
        </label>
        <input
          id={inputId}
          name="time"
          type="datetime-local"
          value={dateTime}
          onChange={(event) => handleDateTimeChange(event.target.value)}
          required
          className="input min-h-[44px]"
          data-testid={inputTestId}
          disabled={disabled}
          aria-required="true"
          aria-invalid={resolvedTimeError ? "true" : undefined}
          aria-describedby={dateTimeDescribedBy}
        />
        <div id={descriptionId} className="text-base mt-1 sr-only">
          {departure
            ? "出発する日時を指定してください"
            : "到着する日時を指定してください"}
        </div>
        {resolvedTimeError && (
          <div
            id={timeErrorId}
            className="text-base-content text-base font-medium leading-relaxed"
            role="alert"
          >
            {resolvedTimeError}
          </div>
        )}
      </div>
    </div>
  );
};

export default DateTimeSelector;
