"use client";

import { useId } from "react";
import { MapPin } from "lucide-react";
import type { GeocodeCandidate } from "@/lib/location/geocoding-search";
import { hasWalkWarning, walkAccessLevel } from "@/lib/transit/walk-access-level";
import { WalkWarning } from "./WalkDistance";

interface LocationCandidatesProps {
  candidates: GeocodeCandidate[];
  onSelect: (candidate: GeocodeCandidate) => void;
  label: string;
  id?: string;
}

const ITEM_CLASS =
  "min-h-[44px] w-full min-w-0 rounded-box border p-2 text-start text-base whitespace-normal break-words transition-colors";

export default function LocationCandidates({
  candidates,
  onSelect,
  label,
  id,
}: LocationCandidatesProps) {
  const generatedListId = useId();
  const listId = id ?? generatedListId;
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 space-y-2 text-base">
      <p role="status" className="sr-only">
        {candidates.length}件の候補があります
      </p>
      <ul id={listId} aria-label={`${label}の候補`} className="min-w-0 space-y-1">
        {candidates.map((candidate) => {
          const key = `${candidate.name}-${candidate.lat}-${candidate.lng}`;
          const contents = (
            <>
              <MapPin className="mr-2 inline h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="font-bold">{candidate.name}</span>
              {candidate.address && candidate.address !== candidate.name && (
                <span className="ml-2 break-words">{candidate.address}</span>
              )}
              {hasWalkWarning(candidate.walkMeters) && (
                <span className="ml-2 inline-block">
                  <WalkWarning walkMeters={candidate.walkMeters} />
                </span>
              )}
            </>
          );

          if (
            candidate.walkMeters !== undefined &&
            walkAccessLevel(candidate.walkMeters) === "tooFar"
          ) {
            return (
              <li key={key} className="min-w-0">
                <div
                  aria-disabled="true"
                  className={`${ITEM_CLASS} border-dashed border-base-300 bg-base-300 cursor-not-allowed`}
                >
                  {contents}
                </div>
              </li>
            );
          }

          return (
            <li key={key} className="min-w-0">
              <button
                type="button"
                className={`${ITEM_CLASS} border-base-300 cursor-pointer hover:bg-base-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
                onClick={() => onSelect(candidate)}
              >
                {contents}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
