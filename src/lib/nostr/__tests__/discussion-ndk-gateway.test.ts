import {
  LegacyNostrServiceDiscussionNdkGateway,
  type NostrEventDTO,
} from "@/lib/nostr/discussion-ndk-gateway";

describe("discussion-ndk-gateway moderator decision draft", () => {
  const createGateway = () =>
    new LegacyNostrServiceDiscussionNdkGateway({} as never);

  const baseDiscussionEvent: NostrEventDTO = {
    id: "discussion-event",
    kind: 34550,
    pubkey: "creator",
    created_at: 100,
    content: "description",
    sig: "sig",
    tags: [
      ["d", "demo"],
      ["name", "Demo"],
      ["description", "description"],
      ["p", "mod-a", "", "moderator"],
    ],
  };

  it("adds applicant to moderator set when decision is approved", () => {
    const gateway = createGateway();

    const draft = gateway.createModeratorDecisionDraft({
      discussionEvent: baseDiscussionEvent,
      applicantPubkey: "mod-b",
      decision: "approved",
      actorPubkey: "creator",
      createdAt: 200,
    });

    expect(draft.kind).toBe(34550);
    expect(draft.pubkey).toBe("creator");
    expect(draft.created_at).toBe(200);
    expect(draft.tags).toEqual(
      expect.arrayContaining([
        ["p", "mod-a", "", "moderator"],
        ["p", "mod-b", "", "moderator"],
      ])
    );
  });

  it("removes applicant from moderator set when decision is unapproved", () => {
    const gateway = createGateway();

    const draft = gateway.createModeratorDecisionDraft({
      discussionEvent: {
        ...baseDiscussionEvent,
        tags: [...baseDiscussionEvent.tags, ["p", "mod-b", "", "moderator"]],
      },
      applicantPubkey: "mod-b",
      decision: "unapproved",
      actorPubkey: "creator",
      createdAt: 201,
    });

    expect(draft.tags).toEqual(
      expect.arrayContaining([["p", "mod-a", "", "moderator"]])
    );
    expect(draft.tags).not.toEqual(
      expect.arrayContaining([["p", "mod-b", "", "moderator"]])
    );
  });
});
