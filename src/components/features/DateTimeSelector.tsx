"use client";

import React, { useState, useEffect, useId } from "react";
import { TransitFormData } from "@/types/core";
import { logger } from "@/utils/logger";

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
  const [dateTime, setDateTime] = useState<string>("");
  const [isDeparture, setIsDeparture] = useState<boolean>(true);
  const uniqueId = useId();
  const inputId = `time-input-${uniqueId}`;
  const labelText = isDeparture ? "出発日時" : "到着日時";
  const timeDescription = isDeparture
    ? "いつ出発するか指定してください"
    : "いつ到着するか指定してください";

  const notifyParent = (formData: TransitFormData) => {
    onSubmit?.(formData);
    onDateTimeSelected?.(formData);
  };

  // 初期値設定
  useEffect(() => {
    if (!dateTime) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const initialDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
      
      setDateTime(initialDateTime);
      notifyParent({
        stopId: initialStopId,
        dateTime: initialDateTime,
        isDeparture,
      });
    }
  }, [initialStopId, isDeparture, dateTime, notifyParent]);

  const handleChange = (newDateTime: string, newIsDeparture: boolean) => {
    setDateTime(newDateTime);
    setIsDeparture(newIsDeparture);
    notifyParent({
      stopId: initialStopId,
      dateTime: newDateTime,
      isDeparture: newIsDeparture,
    });
  };

  const handleTimeTypeChange = (newValue: boolean) => {
    setIsDeparture(newValue);
    logger.log(`時間タイプを切り替え: ${newValue ? "出発" : "到着"}`);
    notifyParent({
      stopId: initialStopId,
      dateTime,
      isDeparture: newValue,
    });
  };

  return (
    <div>
      <div className="space-y-4">
        {/* 出発/到着のラジオボタングループ */}
        <fieldset role="radiogroup" aria-labelledby={`legend-${uniqueId}`}>
          <legend id={`legend-${uniqueId}`} className="sr-only">
            時間タイプを選択
          </legend>
          <div className="space-y-2">
            <label
              htmlFor={`departure-radio-${uniqueId}`}
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                id={`departure-radio-${uniqueId}`}
                name={`time-type-${uniqueId}`}
                type="radio"
                className="radio"
                checked={isDeparture}
                onChange={() => handleTimeTypeChange(true)}
                data-testid="departure-radio"
                disabled={disabled}
              />
              <span className="ruby-text">出発</span>
            </label>
            <label
              htmlFor={`arrival-radio-${uniqueId}`}
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                id={`arrival-radio-${uniqueId}`}
                name={`time-type-${uniqueId}`}
                type="radio"
                className="radio"
                checked={!isDeparture}
                onChange={() => handleTimeTypeChange(false)}
                data-testid="arrival-radio"
                disabled={disabled}
              />
              <span className="ruby-text">到着</span>
            </label>
          </div>
        </fieldset>

        <div className="form-control">
          <label htmlFor={inputId} className="label">
            <span
              className="label-text font-medium mr-2 ruby-text"
              data-testid={isDeparture ? "departure-label" : "arrival-label"}
            >
              {labelText}
            </span>
          </label>
          <input
            id={inputId}
            name={inputId}
            type="datetime-local"
            value={dateTime}
            onChange={(e) => handleChange(e.target.value, isDeparture)}
            required
            className="input min-h-[44px]"
            data-testid={isDeparture ? "departure-input" : "arrival-input"}
            disabled={disabled}
            aria-required="true"
            aria-label={timeDescription}
            aria-describedby={`${inputId}-description`}
          />
          <div
            id={`${inputId}-description`}
            className="text-sm /60 mt-1 sr-only"
          >
            {timeDescription}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateTimeSelector;
