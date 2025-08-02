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

  // 初期値設定
  useEffect(() => {
    // 現在の日時を初期値として設定
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const initialDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

    // 既に値が設定されている場合は更新しない
    if (!dateTime) {
      setDateTime(initialDateTime);

      // 初期値を親に通知
      const formData = {
        stopId: initialStopId,
        dateTime: initialDateTime,
        isDeparture,
      };

      if (onSubmit) {
        onSubmit(formData);
      }

      if (onDateTimeSelected) {
        onDateTimeSelected(formData);
      }
    }
  }, [initialStopId, onSubmit, onDateTimeSelected, isDeparture, dateTime]);

  // 値が変更されたときに親コンポーネントに通知
  const handleChange = (newDateTime: string, newIsDeparture: boolean) => {
    setDateTime(newDateTime);
    setIsDeparture(newIsDeparture);

    const formData = {
      stopId: initialStopId,
      dateTime: newDateTime,
      isDeparture: newIsDeparture,
    };

    if (onSubmit) {
      onSubmit(formData);
    }

    if (onDateTimeSelected) {
      onDateTimeSelected(formData);
    }
  };

  const handleTimeTypeChange = (newValue: boolean) => {
    setIsDeparture(newValue);
    logger.log(`時間タイプを切り替え: ${newValue ? "出発" : "到着"}`);
    if (onDateTimeSelected) {
      onDateTimeSelected({
        dateTime,
        isDeparture: newValue,
      });
    }
  };

  return (
    <div>
      <div className="space-y-4">
        {/* 出発/到着の切り替えラジオボタングループ */}
        <fieldset role="radiogroup" aria-labelledby={`legend-${uniqueId}`}>
          <legend id={`legend-${uniqueId}`} className="sr-only">時間タイプを選択</legend>
          <div className="join">
            <input
              type="radio"
              id={`${uniqueId}-departure`}
              name={`time-type-${uniqueId}`}
              checked={isDeparture}
              onChange={() => handleTimeTypeChange(true)}
              disabled={disabled}
              className="sr-only"
              data-testid="departure-radio"
            />
            <label
              htmlFor={`${uniqueId}-departure`}
              className={`btn join-item ruby-text ${
                isDeparture ? "btn-active btn-primary" : ""
              }`}
              data-testid="departure-tab"
            >
              出発
            </label>

            <input
              type="radio"
              id={`${uniqueId}-arrival`}
              name={`time-type-${uniqueId}`}
              checked={!isDeparture}
              onChange={() => handleTimeTypeChange(false)}
              disabled={disabled}
              className="sr-only"
              data-testid="arrival-radio"
            />
            <label
              htmlFor={`${uniqueId}-arrival`}
              className={`btn join-item ruby-text ${
                !isDeparture ? "btn-active btn-primary" : ""
              }`}
              data-testid="arrival-tab"
            >
              到着
            </label>
          </div>
        </fieldset>

        <div className="form-control">
          <label htmlFor={inputId} className="label ruby-text">
            <span
              className="label-text font-medium mr-2"
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
            className="input input-bordered min-h-[44px]"
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
