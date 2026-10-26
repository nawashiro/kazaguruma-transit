import React from "react";

interface StopTimeDisplayProps {
  stopName: string;
  time: string;
  dateTime?: string;
  className?: string;
}

const StopTimeDisplay: React.FC<StopTimeDisplayProps> = ({
  stopName,
  time,
  dateTime,
}) => {
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-base">
      <div className="min-w-0 flex-1 break-words">
        <div className="font-bold">{stopName}</div>
      </div>
      <time className="badge badge-md bg-base-200 text-base-content h-auto shrink-0 p-3 text-base" dateTime={dateTime}>
        {time}
      </time>
    </div>
  );
};

export default StopTimeDisplay;
