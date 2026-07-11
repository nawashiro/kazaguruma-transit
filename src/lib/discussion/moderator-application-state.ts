import type { Discussion } from "@/types/discussion";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";

export interface ModeratorApplication {
  id: string;
  applicantPubkey: string;
  createdAt: number;
  reason: string;
  event: NostrEventDTO;
}

const isRequest = (event: NostrEventDTO, discussionId: string) =>
  event.kind === 1111 &&
  event.tags.some((tag) => tag[0] === "a" && tag[1] === discussionId) &&
  event.tags.some((tag) => tag[0] === "t" && tag[1] === "moderator-request");

export function derivePendingModeratorApplications(
  discussion: Discussion,
  events: NostrEventDTO[],
): ModeratorApplication[] {
  const moderatorKeys = new Set(
    discussion.moderators.map((moderator) => moderator.pubkey),
  );
  const candidates = events.filter(
    (event) =>
      isRequest(event, discussion.id) &&
      event.created_at >= discussion.event.created_at &&
      !moderatorKeys.has(event.pubkey),
  );
  const latestByApplicant = new Map<string, NostrEventDTO>();
  for (const event of candidates.sort(
    (left, right) =>
      right.created_at - left.created_at || left.id.localeCompare(right.id),
  )) {
    if (!latestByApplicant.has(event.pubkey))
      latestByApplicant.set(event.pubkey, event);
  }
  return [...latestByApplicant.values()].map((event) => ({
    id: event.id,
    applicantPubkey: event.pubkey,
    createdAt: event.created_at,
    reason: event.content,
    event,
  }));
}

/** Returns the latest public application for each user, including active moderators. */
export function deriveLatestModeratorApplications(
  discussionId: string,
  events: NostrEventDTO[],
): Map<string, ModeratorApplication> {
  const latest = new Map<string, NostrEventDTO>();
  for (const event of events
    .filter((candidate) => isRequest(candidate, discussionId))
    .sort(
      (left, right) =>
        right.created_at - left.created_at || left.id.localeCompare(right.id),
    )) {
    if (!latest.has(event.pubkey)) latest.set(event.pubkey, event);
  }
  return new Map(
    [...latest].map(([pubkey, event]) => [
      pubkey,
      {
        id: event.id,
        applicantPubkey: pubkey,
        createdAt: event.created_at,
        reason: event.content,
        event,
      },
    ]),
  );
}

export function calculateNextModeratorPubkeys(
  current: string[],
  approved: string[],
  added: string[],
  removed: string[],
): string[] {
  const next = new Set(current);
  removed.forEach((pubkey) => next.delete(pubkey));
  [...approved, ...added].forEach((pubkey) => next.add(pubkey));
  return [...next];
}

export function calculateModeratorUpdateTimestamp(
  currentCreatedAt: number,
  approvedApplications: ModeratorApplication[],
  now = Math.floor(Date.now() / 1000),
): number {
  return (
    Math.max(
      currentCreatedAt,
      now,
      ...approvedApplications.map((application) => application.createdAt),
    ) + 1
  );
}
