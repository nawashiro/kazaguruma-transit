import { mapDiscussionAuditTimeline } from "@/lib/discussion/audit-timeline-mapper";
import type { NostrEventDTO } from "@/lib/nostr/discussion-ndk-gateway";

const event = (id: string, kind: number, tags: string[][]): NostrEventDTO => ({
  id, kind, tags, pubkey: "a".repeat(64), content: "", created_at: 1, sig: "s",
});

describe("audit timeline approval matching", () => {
  it("matches approval by e tag, not merely the discussion a tag", () => {
    const post = event("post-1", 1111, [["a", "34550:author:topic"]]);
    const approvalForAnotherPost = event("approval-2", 4550, [["a", "34550:author:topic"], ["e", "post-2"]]);
    expect(mapDiscussionAuditTimeline([post, approvalForAnotherPost])[0].approvalState).toBe("unapproved");
  });
});
