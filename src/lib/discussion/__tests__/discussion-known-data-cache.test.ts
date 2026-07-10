import { loadKnownDiscussionData, saveKnownDiscussionData } from "@/lib/discussion/discussion-known-data-cache";

describe("known discussion data cache", () => {
  it("merges event ids and successful relays", () => {
    saveKnownDiscussionData("34550:a:d", { metadata: { title: "first" }, eventIds: ["one"], successfulRelays: ["wss://one"] });
    saveKnownDiscussionData("34550:a:d", { metadata: { title: "second" }, eventIds: ["one", "two"], successfulRelays: ["wss://two"] });
    expect(loadKnownDiscussionData<{ title: string }>("34550:a:d")).toMatchObject({ metadata: { title: "second" }, eventIds: ["one", "two"], successfulRelays: ["wss://one", "wss://two"] });
  });
});
