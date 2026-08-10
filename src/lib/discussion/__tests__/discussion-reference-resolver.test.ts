import { resolveDiscussionReferences } from "@/lib/discussion/discussion-reference-resolver";

const pubkey = "a".repeat(64);
const secondPubkey = "b".repeat(64);

describe("resolveDiscussionReferences", () => {
  it("creates one kind-34550 author and d-tag filter per unique canonical q reference", () => {
    const result = resolveDiscussionReferences([
      ["q", `34550:${pubkey}:first-discussion`],
      ["q", `34550:${secondPubkey}:second-discussion`],
      ["q", `34550:${pubkey}:first-discussion`],
    ]);

    expect(result.references).toEqual([
      {
        discussionId: `34550:${pubkey}:first-discussion`,
        authorPubkey: pubkey,
        dTag: "first-discussion",
        relayHints: [],
      },
      {
        discussionId: `34550:${secondPubkey}:second-discussion`,
        authorPubkey: secondPubkey,
        dTag: "second-discussion",
        relayHints: [],
      },
    ]);
    expect(result.filters).toEqual([
      { kinds: [34550], authors: [pubkey], "#d": ["first-discussion"], limit: 1 },
      { kinds: [34550], authors: [secondPubkey], "#d": ["second-discussion"], limit: 1 },
    ]);
  });

  it("excludes q values that are not canonical kind-34550 references", () => {
    const result = resolveDiscussionReferences([
      ["q", `34550:${pubkey}:valid`],
      ["q", `34550:${"x".repeat(64)}:invalid-pubkey`],
      ["q", `34550:${pubkey}:`],
      ["q", `34550:${pubkey}:contains:colon`],
      ["q", `34550:${pubkey}:contains-naddr1-value`],
      ["q", `1:${pubkey}:wrong-kind`],
      ["e", `34550:${secondPubkey}:not-a-q-tag`],
    ]);

    expect(result.references).toEqual([
      {
        discussionId: `34550:${pubkey}:valid`,
        authorPubkey: pubkey,
        dTag: "valid",
        relayHints: [],
      },
    ]);
  });
});
