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

  const toggleTimeType = () => {
    setIsDeparture(!isDeparture);
  };

  return (
    <form onSubmit={handleSubmit} className="transit-form">
      <div className="form-group">
        <div className="time-toggle">
          <button
            type="button"
            className={isDeparture ? "active" : ""}
            onClick={toggleTimeType}
            disabled={isDeparture}
          >
            出発
          </button>
          <button
            type="button"
            className={!isDeparture ? "active" : ""}
            onClick={toggleTimeType}
            disabled={!isDeparture}
          >
            到着
          </button>
        </div>

        {isDeparture ? (
          <div className="time-input">
            <label htmlFor="departure-time">出発日時</label>
            <input
              id="departure-time"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              required
            />
          </div>
        ) : (
          <div className="time-input">
            <label htmlFor="arrival-time">到着日時</label>
            <input
              id="arrival-time"
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              required
            />
          </div>
        )}
      </div>

      <button type="submit" className="search-button">
        検索
      </button>
    </form>
  );
};

export default DateTimeSelector;
