import { createDiscussionReadPlan, sortEventsByTimeAndId } from "@/lib/discussion/discussion-read-plan";

const strategy = { relayLimit: 3, idleTimeoutMs: 500, hardTimeoutMs: 1500, dedupWindowMs: 250 };

describe("discussion read plan", () => {
  it("limits audit requests to ten and keeps the cursor", () => {
    expect(createDiscussionReadPlan("discussion-audit", strategy, { discussionId: "34550:a:d", until: 100 }).filters).toEqual([
      { kinds: [1111, 1], "#a": ["34550:a:d"], limit: 10, until: 100 },
    ]);
  });

  it("sorts equal timestamps by event id", () => {
    expect(sortEventsByTimeAndId([{ id: "b", created_at: 1 }, { id: "a", created_at: 1 }]).map((event) => event.id)).toEqual(["a", "b"]);
  });
});
