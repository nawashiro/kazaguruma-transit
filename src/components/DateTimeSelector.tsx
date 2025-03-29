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
        {/* daisyUIのtabsコンポーネントを使用 */}
        <div role="tablist" className="tabs tabs-boxed mb-4">
          <a
            role="tab"
            className={`tab ${isDeparture ? "tab-active" : ""}`}
            onClick={() => toggleTimeType(true)}
            data-testid="departure-tab"
          >
            出発
          </a>
          <a
            role="tab"
            className={`tab ${!isDeparture ? "tab-active" : ""}`}
            onClick={() => toggleTimeType(false)}
            data-testid="arrival-tab"
          >
            到着
          </a>
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
