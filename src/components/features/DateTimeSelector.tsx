"use client";

import React, { useState, useEffect, useId, useRef } from "react";
import { TransitFormData } from "@/types/core";

interface DateTimeSelectorProps {
  initialStopId?: string;
  onSubmit?: (formData: TransitFormData) => void;
  onDateTimeSelected?: (formData: TransitFormData) => void;
  disabled?: boolean;
}

const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  initialStopId = "",
  onSubmit,
  onDateTimeSelected,
  disabled = false,
}) => {
  const [dateTime, setDateTime] = useState("");
  const [isDeparture, setIsDeparture] = useState(true);
  const initialized = useRef(false);
  const uniqueId = useId();
  const inputId = `time-input-${uniqueId}`;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const initialDateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setDateTime(initialDateTime);
    const formData = {
      stopId: initialStopId,
      dateTime: initialDateTime,
      isDeparture: true,
    };
    onSubmit?.(formData);
    onDateTimeSelected?.(formData);
  }, [initialStopId, onSubmit, onDateTimeSelected]);

  const handleChange = (newDateTime: string, newIsDeparture: boolean) => {
    setDateTime(newDateTime);
    setIsDeparture(newIsDeparture);
    const formData = {
      stopId: initialStopId,
      dateTime: newDateTime,
      isDeparture: newIsDeparture,
    };
    onSubmit?.(formData);
    onDateTimeSelected?.(formData);
  };

  return (
    <fieldset className="fieldset min-w-0 w-full space-y-4 border border-base-300 rounded-box bg-base-200 p-4 text-base">
        <legend className="fieldset-legend text-base">日時</legend>
        <div className="space-y-2">
          <label htmlFor={`departure-radio-${uniqueId}`} className="flex cursor-pointer items-center gap-2 text-base">
            <input
              id={`departure-radio-${uniqueId}`}
              name="isDeparture"
              value="true"
              type="radio"
              className="radio"
              checked={isDeparture}
              onChange={() => handleChange(dateTime, true)}
              disabled={disabled}
            />
            <span className="ruby-text">出発</span>
          </label>
          <label htmlFor={`arrival-radio-${uniqueId}`} className="flex cursor-pointer items-center gap-2 text-base">
            <input
              id={`arrival-radio-${uniqueId}`}
              name="isDeparture"
              value="false"
              type="radio"
              className="radio"
              checked={!isDeparture}
              onChange={() => handleChange(dateTime, false)}
              disabled={disabled}
            />
            <span className="ruby-text">到着</span>
          </label>
        </div>
      <div className="form-control">
        <label htmlFor={inputId} className="label text-base text-base-content">
          <span className="font-medium mr-2 ruby-text">日時</span>
        </label>
        <input
          id={inputId}
          name="time"
          type="datetime-local"
          value={dateTime}
          onChange={(event) => handleChange(event.target.value, isDeparture)}
          required
          className="input min-h-[44px] w-full min-w-0 text-base"
          disabled={disabled}
        />
      </div>
    </fieldset>
  );
};

export default DateTimeSelector;
