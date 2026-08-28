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
}) => {
  return (
    <div className="flex justify-between items-center mb-2">
      <div className="flex-1">
        <div className="font-bold">{stopName}</div>
      </div>
      <time className="badge badge-secondary badge-md p-3" dateTime={dateTime}>
        {time}
      </time>
    </div>
  );
};

export default StopTimeDisplay;
