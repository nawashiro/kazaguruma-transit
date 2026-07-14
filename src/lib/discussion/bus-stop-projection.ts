import type { Event } from "@/lib/nostr/nostr-service";
import { combinePostsWithStats, parseApprovalEvent, parseEvaluationEvent, parsePostEvent } from "@/lib/nostr/nostr-utils";
import type { PostEvaluation, PostWithStats } from "@/types/discussion";

export interface BusStopProjectionInput {
  primaryEvents: Event[];
  approvalEvents: Event[];
  evaluationEvents?: Event[];
  busStops: string[];
  approvalState?: "approved" | "unapproved" | "unknown";
}

export interface BusStopProjection {
  posts: PostWithStats[];
  topPostsByStop: Map<string, PostWithStats>;
  evaluations: PostEvaluation[];
}

export function projectBusStopSnapshot(input: BusStopProjectionInput): BusStopProjection {
  const approvals = input.approvalEvents.map(parseApprovalEvent).filter((event): event is NonNullable<ReturnType<typeof parseApprovalEvent>> => event !== null);
  const posts = input.primaryEvents
    .map((event) => parsePostEvent(event, approvals))
    .filter((post): post is NonNullable<ReturnType<typeof parsePostEvent>> => post !== null)
    .filter((post) => input.busStops.includes(post.busStopTag ?? ""));
  const evaluations = (input.evaluationEvents ?? []).map(parseEvaluationEvent).filter((event): event is PostEvaluation => event !== null);
  const visiblePosts = input.approvalState === "unknown" ? [] : posts.filter((post) => post.approved);
  const postsWithStats = combinePostsWithStats(visiblePosts, evaluations);
  const topPostsByStop = new Map<string, PostWithStats>();
  input.busStops.forEach((stop) => {
    const top = [...postsWithStats]
      .filter((post) => post.busStopTag === stop)
      .sort((a, b) => b.evaluationStats.score - a.evaluationStats.score)[0];
    if (top) topPostsByStop.set(stop, top);
  });
  return { posts: postsWithStats, topPostsByStop, evaluations };
}
