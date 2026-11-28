"use client";

import { useId } from "react";
import { MapPin, MapPinX } from "lucide-react";
import type { GeocodeCandidate } from "@/lib/location/geocoding-search";
import { walkAccessLevel } from "@/lib/transit/walk-access-level";
import { WalkWarning } from "./WalkDistance";

interface LocationCandidatesProps {
  candidates: GeocodeCandidate[];
  onSelect: (candidate: GeocodeCandidate) => void;
  label: string;
  id?: string;
}

const ITEM_CLASS =
  "min-h-[44px] w-full min-w-0 rounded-box border p-2 text-start text-base whitespace-normal break-words transition-colors";

function isUnselectable(candidate: GeocodeCandidate): boolean {
  return (
    candidate.walkMeters !== undefined &&
    walkAccessLevel(candidate.walkMeters) === "tooFar"
  );
}

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
        {candidates.map((candidate, index) => {
          const key = `${candidate.name}-${candidate.lat}-${candidate.lng}`;
          const unselectable = isUnselectable(candidate);
          const reasonId = `${listId}-${index}-reason`;
          const Icon = unselectable ? MapPinX : MapPin;

          return (
            <li key={key} className="min-w-0">
              <button
                type="button"
                aria-disabled={unselectable || undefined}
                aria-describedby={unselectable ? reasonId : undefined}
                className={`${ITEM_CLASS} ${
                  unselectable
                    ? "border-dashed border-base-300 bg-base-300"
                    : "border-base-300 cursor-pointer hover:bg-base-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                }`}
                onClick={unselectable ? undefined : () => onSelect(candidate)}
              >
                <Icon className="mr-2 inline h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-bold">{candidate.name}</span>
                {candidate.address && candidate.address !== candidate.name && (
                  <span className="ml-2 break-words">{candidate.address}</span>
                )}
                <span className="ml-2 inline-block" aria-hidden={unselectable || undefined}>
                  <WalkWarning walkMeters={candidate.walkMeters} />
                </span>
              </button>
              {unselectable && (
                <span id={reasonId} className="sr-only">
                  バス停から遠すぎるため、この地点は選べません。
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
