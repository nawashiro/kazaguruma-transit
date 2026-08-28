import type { NdkEventFilter } from "@/lib/nostr/discussion-ndk-gateway";

export interface DiscussionReference {
  discussionId: string;
  authorPubkey: string;
  dTag: string;
}

export interface DiscussionReferenceResolution {
  references: DiscussionReference[];
  filters: NdkEventFilter[];
}

const CANONICAL_DISCUSSION_REFERENCE = /^34550:([a-fA-F0-9]{64}):([^:\s]+)$/;

const parseDiscussionReference = (value: string): DiscussionReference | null => {
  const match = CANONICAL_DISCUSSION_REFERENCE.exec(value);
  if (!match) return null;

  const [, authorPubkey, dTag] = match;
  if (dTag.includes("naddr1")) return null;
  return {
    discussionId: value,
    authorPubkey,
    dTag,
  };
};

/** Resolves canonical discussion addresses found in q tags without performing network I/O. */
export const resolveDiscussionReferences = (
  tags: readonly string[][]
): DiscussionReferenceResolution => {
  const references: DiscussionReference[] = [];
  const seenDiscussionIds = new Set<string>();

  for (const tag of tags) {
    if (tag[0] !== "q" || typeof tag[1] !== "string") continue;

    const reference = parseDiscussionReference(tag[1]);
    if (!reference || seenDiscussionIds.has(reference.discussionId)) continue;

    seenDiscussionIds.add(reference.discussionId);
    references.push(reference);
  }

  return {
    references,
    filters: references.map(({ authorPubkey, dTag }) => ({
      kinds: [34550],
      authors: [authorPubkey],
      "#d": [dTag],
      limit: 1,
    })),
  };
};
