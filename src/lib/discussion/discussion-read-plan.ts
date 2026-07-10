import type { DiscussionReadStrategyConfig } from "@/lib/config/discussion-config";
import type { NdkEventFilter } from "@/lib/nostr/discussion-ndk-gateway";

export type DiscussionReadTarget =
  | "discussion-list"
  | "discussion-meta"
  | "discussion-approvals"
  | "discussion-evaluations"
  | "discussion-audit"
  | "discussion-edit";

export interface DiscussionReadPlan {
  target: DiscussionReadTarget;
  filters: NdkEventFilter[];
  relayHints: string[];
  idleTimeoutMs: number;
  hardTimeoutMs: number;
}

export const sortEventsByTimeAndId = <T extends { created_at: number; id: string }>(events: T[]): T[] =>
  [...events].sort((left, right) => right.created_at - left.created_at || left.id.localeCompare(right.id));

export const createDiscussionReadPlan = (
  target: DiscussionReadTarget,
  strategy: DiscussionReadStrategyConfig,
  args: { discussionId?: string; authorPubkey?: string; dTag?: string; postIds?: string[]; until?: number; relayHints?: string[] }
): DiscussionReadPlan => {
  const limit = target === "discussion-audit" ? 10 : target === "discussion-meta" ? 1 : target === "discussion-evaluations" ? 100 : 50;
  let filter: NdkEventFilter;
  switch (target) {
    case "discussion-meta":
      filter = { kinds: [34550], authors: args.authorPubkey ? [args.authorPubkey] : [], "#d": args.dTag ? [args.dTag] : [], limit };
      break;
    case "discussion-evaluations":
      filter = { kinds: [7], "#e": args.postIds ?? [], limit };
      break;
    case "discussion-audit":
      filter = { kinds: [1111, 1, 4550], "#a": args.discussionId ? [args.discussionId] : [], limit, until: args.until };
      break;
    case "discussion-list":
    case "discussion-edit":
      filter = { kinds: [34550], authors: args.authorPubkey ? [args.authorPubkey] : [], limit };
      break;
    default:
      filter = { kinds: [4550], "#a": args.discussionId ? [args.discussionId] : [], limit };
  }
  return { target, filters: [filter], relayHints: args.relayHints ?? [], idleTimeoutMs: strategy.idleTimeoutMs, hardTimeoutMs: strategy.hardTimeoutMs };
};
