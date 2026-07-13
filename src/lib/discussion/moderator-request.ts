export interface TaggedNostrEvent {
  kind: number;
  tags: string[][];
}

/** Moderator promotion requests are workflow events, not discussion posts. */
export const isModeratorRequestEvent = (event: TaggedNostrEvent): boolean =>
  event.kind === 1111 &&
  event.tags.some(
    (tag) => tag[0] === "t" && tag[1] === "moderator-request",
  );
