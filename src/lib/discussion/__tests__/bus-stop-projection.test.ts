import { projectBusStopSnapshot } from "../bus-stop-projection";
import type { Event } from "@/lib/nostr/nostr-service";
import { naddrEncode } from "@/lib/nostr/naddr-utils";

const discussionId = naddrEncode({ kind: 34550, pubkey: "c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8", identifier: "topic" });

const event = (overrides: Partial<Event>): Event => ({
  id: "post-1", sig: "sig", kind: 1111, pubkey: "author", created_at: 1,
  content: "メモ", tags: [["a", discussionId], ["t", "停留所A"]], ...overrides,
});

describe("bus-stop-projection", () => {
  it("joins approvals and preserves unknown as no visible approval", () => {
    const input = { primaryEvents: [event({})], approvalEvents: [event({ id: "approval", kind: 4550, pubkey: "mod", tags: [["a", discussionId], ["e", "post-1"], ["p", "author"]] })], busStops: ["停留所A"] };
    expect(projectBusStopSnapshot(input).posts).toHaveLength(1);
    expect(projectBusStopSnapshot({ ...input, approvalState: "unknown" }).posts).toHaveLength(0);
  });

  it("selects the highest scored representative per stop", () => {
    const posts = [event({ id: "p1", content: "低評価" }), event({ id: "p2", content: "高評価" })];
    const approvals = posts.map((post) => event({ id: `a-${post.id}`, kind: 4550, tags: [["a", discussionId], ["e", post.id], ["p", "author"]] }));
    const evaluations = [event({ id: "e1", kind: 7, pubkey: "u", content: "+", tags: [["e", "p2"]] })];
    expect(projectBusStopSnapshot({ primaryEvents: posts, approvalEvents: approvals, evaluationEvents: evaluations, busStops: ["停留所A"] }).topPostsByStop.get("停留所A")?.id).toBe("p2");
  });
});
