"use client";

import React, { useState, useEffect } from "react";

interface DateTimeSelectorProps {
  initialStopId: string;
  onSubmit: (formData: {
    stopId: string;
    dateTime: string;
    isDeparture: boolean;
  }) => void;
}

const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  initialStopId,
  onSubmit,
}) => {
  const [dateTime, setDateTime] = useState<string>("");
  const [isDeparture, setIsDeparture] = useState<boolean>(true);

  useEffect(() => {
    // 現在の日時を初期値として設定
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      stopId: initialStopId,
      dateTime: dateTime,
      isDeparture,
    });
  };

  const toggleTimeType = (newValue: boolean) => {
    setIsDeparture(newValue);
  };

  const inputId = isDeparture ? "departure-time" : "arrival-time";

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="mb-4">
        {/* カスタムデザインのトグルを実装 */}
        <div className="flex rounded-lg overflow-hidden mb-4">
          <button
            type="button"
            className={`flex-1 py-3 px-4 font-medium transition-colors duration-200 ${
              isDeparture
                ? "bg-black text-white font-bold"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => toggleTimeType(true)}
            data-testid="departure-tab"
          >
            出発
          </button>
          <button
            type="button"
            className={`flex-1 py-3 px-4 font-medium transition-colors duration-200 ${
              !isDeparture
                ? "bg-black text-white font-bold"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
            onClick={() => toggleTimeType(false)}
            data-testid="arrival-tab"
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
            onChange={(e) => setDateTime(e.target.value)}
            required
            className="input input-bordered w-full"
            data-testid={isDeparture ? "departure-input" : "arrival-input"}
          />
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary w-full mt-4"
        data-testid="search-button"
      >
        検索
      </button>
    </form>
  );
};

export default DateTimeSelector;
