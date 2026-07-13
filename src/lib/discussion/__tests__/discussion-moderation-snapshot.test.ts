import {
  createDiscussionModerationSnapshot,
  loadDiscussionModerationSnapshot,
} from "@/lib/discussion/discussion-moderation-snapshot";
import type { Event } from "@/lib/nostr/nostr-service";

const post = (id: string): Event => ({ id, kind: 1111, pubkey: "author", created_at: 1, content: "post", tags: [["a", "34550:author:topic"]], sig: "sig" });
const moderatorRequest: Event = { id: "moderator-request", kind: 1111, pubkey: "applicant", created_at: 3, content: "request", tags: [["a", "34550:author:topic"], ["t", "moderator-request"]], sig: "sig" };
const approval = (postId: string): Event => ({ id: `approval-${postId}`, kind: 4550, pubkey: "moderator", created_at: 2, content: "", tags: [["e", postId]], sig: "sig" });
const candidates = ["wss://one", "wss://two", "wss://three", "wss://four"].map((url) => ({ url, source: "configured" as const }));

describe("createDiscussionModerationSnapshot", () => {
  it("excludes moderator requests from primary events", () => {
    const snapshot = createDiscussionModerationSnapshot({
      discussionId: "34550:author:topic",
      primaryEvents: [post("post-1"), moderatorRequest],
      approvalEvents: [],
      relayCandidates: candidates,
      attemptedRelayUrls: candidates.map((candidate) => candidate.url),
      completionReason: "eose",
    });

    expect(snapshot.primaryEvents.map((event) => event.id)).toEqual(["post-1"]);
  });

  it("marks a primary event approved when its approval is observed", () => {
    expect(createDiscussionModerationSnapshot({ discussionId: "d", primaryEvents: [post("post-1")], approvalEvents: [approval("post-1")], relayCandidates: candidates, attemptedRelayUrls: ["wss://one"], completionReason: "eose" }).approvalState).toBe("approved");
  });

  it("keeps an unobserved approval unknown after a partial read", () => {
    expect(createDiscussionModerationSnapshot({ discussionId: "d", primaryEvents: [post("post-1")], approvalEvents: [], relayCandidates: candidates, attemptedRelayUrls: ["wss://one", "wss://two", "wss://three"], completionReason: "idle-timeout" }).approvalState).toBe("unknown");
  });

  it("marks unapproved only after every candidate reaches EOSE without approval", () => {
    expect(createDiscussionModerationSnapshot({ discussionId: "d", primaryEvents: [post("post-1")], approvalEvents: [], relayCandidates: candidates, attemptedRelayUrls: candidates.map((candidate) => candidate.url), completionReason: "eose" }).approvalState).toBe("unapproved");
  });

  it("does not treat an approval for another post as approval", () => {
    expect(createDiscussionModerationSnapshot({
      discussionId: "d",
      primaryEvents: [post("post-1")],
      approvalEvents: [approval("post-2")],
      relayCandidates: candidates,
      attemptedRelayUrls: candidates.map((candidate) => candidate.url),
      completionReason: "eose",
    }).approvalState).toBe("unapproved");
  });

  it("keeps three consumers on the same approval decision", () => {
    const input = {
      discussionId: "d",
      primaryEvents: [post("post-1")],
      approvalEvents: [approval("post-1")],
      relayCandidates: candidates,
      attemptedRelayUrls: candidates.map((candidate) => candidate.url),
      completionReason: "eose" as const,
    };
    expect([
      createDiscussionModerationSnapshot(input).approvalState,
      createDiscussionModerationSnapshot(input).approvalState,
      createDiscussionModerationSnapshot(input).approvalState,
    ]).toEqual(["approved", "approved", "approved"]);
  });

  it("moves from unknown to approved when a delayed approval arrives from another relay", () => {
    const initial = createDiscussionModerationSnapshot({
      discussionId: "d",
      primaryEvents: [post("post-1")],
      approvalEvents: [],
      relayCandidates: candidates,
      attemptedRelayUrls: ["wss://one"],
      completionReason: "idle-timeout",
    });
    const refreshed = createDiscussionModerationSnapshot({
      discussionId: "d",
      primaryEvents: [post("post-1")],
      approvalEvents: [approval("post-1")],
      relayCandidates: candidates,
      attemptedRelayUrls: ["wss://two", "wss://three", "wss://four"],
      completionReason: "eose",
    });
    expect(initial.approvalState).toBe("unknown");
    expect(refreshed.approvalState).toBe("approved");
  });
});

describe("loadDiscussionModerationSnapshot", () => {
  it("preserves an approval read timeout when the post read completed", async () => {
    const completion = (events: Event[], completionReason: "eose" | "idle-timeout") => ({
      events,
      completionReason,
      eventCount: events.length,
      elapsedMs: 1,
      startedAt: 1,
      lastEventAt: 1,
      eoseReceived: completionReason === "eose",
      relayUrls: ["wss://one"],
      duplicateCount: 0,
      sourceRelayUrlsByEventId: {},
    });
    const service = {
      getEventsWithCompletion: jest.fn()
        .mockResolvedValueOnce(completion([post("post-1")], "eose"))
        .mockResolvedValueOnce(completion([], "idle-timeout")),
    };

    const snapshot = await loadDiscussionModerationSnapshot(
      service,
      { relayLimit: 3, idleTimeoutMs: 100, hardTimeoutMs: 300, dedupWindowMs: 0 },
      {
        discussionId: "34550:author:topic",
        configured: ["wss://one"],
        defaults: [],
      },
    );

    expect(snapshot.completionReason).toBe("idle-timeout");
    expect(snapshot.approvalState).toBe("unknown");
  });
});
