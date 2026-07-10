import { createDiscussionModerationSnapshot } from "@/lib/discussion/discussion-moderation-snapshot";
import type { Event } from "@/lib/nostr/nostr-service";

const post = (id: string): Event => ({ id, kind: 1111, pubkey: "author", created_at: 1, content: "post", tags: [["a", "34550:author:topic"]], sig: "sig" });
const approval = (postId: string): Event => ({ id: `approval-${postId}`, kind: 4550, pubkey: "moderator", created_at: 2, content: "", tags: [["e", postId]], sig: "sig" });
const candidates = ["wss://one", "wss://two", "wss://three", "wss://four"].map((url) => ({ url, source: "configured" as const }));

describe("createDiscussionModerationSnapshot", () => {
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
});
