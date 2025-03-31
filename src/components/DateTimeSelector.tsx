"use client";

import React, { useState, useEffect } from "react";
import { TransitFormData } from "../types/transit";
import { logger } from "../utils/logger";

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

  const inputId = isDeparture ? "departure-time" : "arrival-time";

  return (
    <div className="w-full">
      <div className="mb-4">
        {/* カスタムデザインのトグルを実装 */}
        <div className="flex rounded-lg overflow-hidden mb-4">
          <button
            type="button"
            className={`flex-1 py-3 px-4 font-medium transition-colors duration-200 ${
              isDeparture
                ? "bg-gray-300 text-gray-800"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => handleTimeTypeChange(true)}
            data-testid="departure-tab"
            disabled={disabled}
          >
            出発
          </button>
          <button
            type="button"
            className={`flex-1 py-3 px-4 font-medium transition-colors duration-200 ${
              !isDeparture
                ? "bg-gray-300 text-gray-800"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => handleTimeTypeChange(false)}
            data-testid="arrival-tab"
            disabled={disabled}
          >
            到着
          </button>
        </div>

        <div className="form-control w-full">
          <label htmlFor={inputId} className="label">
            <span
              className="label-text font-medium"
              data-testid={isDeparture ? "departure-label" : "arrival-label"}
            >
              {isDeparture ? "出発日時" : "到着日時"}
            </span>
          </label>
          <input
            id={inputId}
            name={inputId}
            type="datetime-local"
            value={dateTime}
            onChange={(e) => handleChange(e.target.value, isDeparture)}
            required
            className="input input-bordered w-full"
            data-testid={isDeparture ? "departure-input" : "arrival-input"}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export default DateTimeSelector;
