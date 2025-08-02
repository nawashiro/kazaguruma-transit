import React from "react";

interface StopTimeDisplayProps {
  stopName: string;
  time: string;
  dateTime?: string;
  className?: string;
}

/**
 * 停留所名と時刻を表示するコンポーネント
 */
const StopTimeDisplay: React.FC<StopTimeDisplayProps> = ({
  stopName,
  time,
  dateTime,
  className = "mb-2",
}) => {
  return (
    <div className={`flex justify-between items-center ${className}`}>
      <div className="flex-1">
        <div className="font-bold">{stopName}</div>
      </div>
      <time className="badge badge-secondary text-lg p-3" dateTime={dateTime}>
        {time}
      </time>
    </div>
  );
};

export default StopTimeDisplay;
