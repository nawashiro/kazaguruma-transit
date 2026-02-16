import { naddrEncode } from "../naddr-utils";
import {
  parsePostEvent,
  parseApprovalEvent,
  parseEvaluationEvent,
} from "../nostr-utils";

jest.mock("@/utils/logger", () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("nostr-utils discussion id normalization", () => {
  const discussionPointer = {
    kind: 34550,
    pubkey:
      "c98215056966766d3aafb43471cc72d59a9dfd2885aad27a33da31685f7cfef8",
    identifier: "bus-stop-chat",
  };
  const discussionId = `34550:${discussionPointer.pubkey}:${discussionPointer.identifier}`;
  const discussionNaddr = naddrEncode(discussionPointer);

  it("parsePostEvent normalizes naddr discussion tag", () => {
    const event = {
      id: "post-1",
      kind: 1111,
      pubkey: "author",
      content: "hello",
      created_at: 100,
      tags: [["a", discussionNaddr]],
      sig: "sig",
    };

    const parsed = parsePostEvent(event as any);

    expect(parsed?.discussionId).toBe(discussionId);
  });

  it("parsePostEvent rejects invalid discussion tag", () => {
    const event = {
      id: "post-2",
      kind: 1,
      pubkey: "author",
      content: "hello",
      created_at: 100,
      tags: [["a", `34550:${discussionPointer.pubkey}:naddr1invalid`]],
      sig: "sig",
    };

    const parsed = parsePostEvent(event as any);

    expect(parsed).toBeNull();
  });

  it("parseApprovalEvent normalizes naddr discussion tag", () => {
    const event = {
      id: "approval-1",
      kind: 4550,
      pubkey: "moderator",
      content: "",
      created_at: 100,
      tags: [
        ["a", discussionNaddr],
        ["e", "post-1"],
        ["p", "author"],
      ],
      sig: "sig",
    };

    const parsed = parseApprovalEvent(event as any);

    expect(parsed?.discussionId).toBe(discussionId);
  });

  it("parseEvaluationEvent rejects invalid discussion tag", () => {
    const event = {
      id: "eval-1",
      kind: 7,
      pubkey: "evaluator",
      content: "+",
      created_at: 100,
      tags: [
        ["e", "post-1"],
        ["a", `34550:${discussionPointer.pubkey}:naddr1invalid`],
      ],
      sig: "sig",
    };

    const parsed = parseEvaluationEvent(event as any);

    expect(parsed).toBeNull();
  });
});
