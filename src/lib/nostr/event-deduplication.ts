export interface EventIdentityFields {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  tags: readonly (readonly string[])[];
}

export const getEventIdentity = <T extends EventIdentityFields>(
  event: T
): string => {
  if (
    event.kind === 0 ||
    event.kind === 3 ||
    (event.kind >= 10000 && event.kind < 20000)
  ) {
    return `${event.kind}:${event.pubkey}`;
  }

  if (event.kind >= 30000 && event.kind < 40000) {
    const dTag = event.tags.find(
      (tag) => tag[0] === "d" && Boolean(tag[1])
    )?.[1];
    if (dTag) {
      return `${event.kind}:${event.pubkey}:${dTag}`;
    }
  }

  return event.id;
};

const compareEventIds = (firstId: string, secondId: string): number => {
  if (firstId < secondId) return -1;
  if (firstId > secondId) return 1;
  return 0;
};

const isPreferredEvent = <T extends EventIdentityFields>(
  candidate: T,
  existing: T
): boolean =>
  candidate.created_at > existing.created_at ||
  (candidate.created_at === existing.created_at &&
    compareEventIds(candidate.id, existing.id) < 0);

export const dedupeAndSortEvents = <T extends EventIdentityFields>(
  events: readonly T[]
): T[] => {
  const eventsByIdentity = new Map<string, T>();

  for (const event of events) {
    const identity = getEventIdentity(event);
    const existing = eventsByIdentity.get(identity);
    if (!existing || isPreferredEvent(event, existing)) {
      eventsByIdentity.set(identity, event);
    }
  }

  return Array.from(eventsByIdentity.values()).sort(
    (first, second) =>
      second.created_at - first.created_at ||
      compareEventIds(first.id, second.id)
  );
};
