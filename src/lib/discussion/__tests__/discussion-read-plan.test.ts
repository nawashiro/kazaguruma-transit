import { createDiscussionReadPlan } from "@/lib/discussion/discussion-read-plan";

const strategy = {
  idleTimeoutMs: 100,
  hardTimeoutMs: 300,

  dedupWindowMs: 1_000,
};
const pubkey = "a".repeat(64);

describe("createDiscussionReadPlan", () => {
  it("creates one multi-filter referenced-discussion plan from normalized references", () => {
    const plan = createDiscussionReadPlan("discussion-references", strategy, {
      references: [
        { authorPubkey: pubkey, dTag: "first" },
        { authorPubkey: "b".repeat(64), dTag: "second" },
      ],
    });

    expect(plan.filters).toEqual([
      { kinds: [34550], authors: [pubkey], "#d": ["first"], limit: 1 },
      { kinds: [34550], authors: ["b".repeat(64)], "#d": ["second"], limit: 1 },
    ]);
  });
});
