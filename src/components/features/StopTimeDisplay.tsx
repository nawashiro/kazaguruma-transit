import React from "react";
import { generateGoogleMapPointLink } from "@/utils/maps";

interface StopTimeDisplayProps {
  stopName: string;
  time: string;
  dateTime?: string;
  href?: string;
  className?: string;
}

const StopTimeDisplay: React.FC<StopTimeDisplayProps> = ({
  stopName,
  time,
  dateTime,
  href,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-base sm:justify-start">
      <div className="min-w-0 flex-1 break-words font-bold sm:w-72 sm:flex-none">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="link">
            {stopName}
          </a>
        ) : (
          stopName
        )}
      </div>
      <time className="badge badge-md bg-base-200 text-base-content h-auto shrink-0 p-3 text-base" dateTime={dateTime}>
        {time}
      </time>
    </div>
  );
};

export default StopTimeDisplay;
