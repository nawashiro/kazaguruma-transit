"use client";

import { useId } from "react";
import { MapPin } from "lucide-react";
import type { GeocodeCandidate } from "@/lib/location/geocoding-search";

interface LocationCandidatesProps {
  candidates: GeocodeCandidate[];
  onSelect: (candidate: GeocodeCandidate) => void;
  label: string;
  id?: string;
}

export default function LocationCandidates({
  candidates,
  onSelect,
  label,
  id,
}: LocationCandidatesProps) {
  const headingId = useId();
  const generatedListId = useId();
  const listId = id ?? generatedListId;
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 space-y-2 text-base">
      <p id={headingId} className="font-bold ruby-text">
        {label}の候補から選ぶ
      </p>
      <p role="status" className="text-base">
        {candidates.length}件の候補があります
      </p>
      <ul id={listId} aria-labelledby={headingId} className="min-w-0 space-y-1">
        {candidates.map((candidate) => (
          <li key={`${candidate.name}-${candidate.lat}-${candidate.lng}`} className="min-w-0">
            <button
              type="button"
              className="min-h-[44px] w-full min-w-0 rounded-box border border-base-300 p-2 text-start text-base whitespace-normal break-words hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => onSelect(candidate)}
            >
              <MapPin className="mr-2 inline h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="font-bold">{candidate.name}</span>
              {candidate.address && candidate.address !== candidate.name && (
                <span className="ml-2 break-words">{candidate.address}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
