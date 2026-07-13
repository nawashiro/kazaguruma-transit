import { rankRelayCandidates, selectRelayCandidates } from "@/lib/discussion/relay-candidate-selector";

describe("selectRelayCandidates", () => {
  it("prioritizes hints and removes duplicates within the configured cap", () => {
    expect(selectRelayCandidates({
      hints: ["wss://hint", "wss://shared"],
      successful: ["wss://shared", "wss://successful"],
      configured: ["wss://configured"],
      defaults: ["wss://default"],
      limit: 3,
    }).map((candidate) => candidate.url)).toEqual(["wss://hint", "wss://shared", "wss://successful"]);
  });

  it("keeps untried candidates available for a bounded follow-up read", () => {
    const candidates = rankRelayCandidates({
      hints: ["wss://hint-1", "wss://hint-2", "wss://hint-3"],
      successful: ["wss://successful"],
      configured: ["wss://configured"],
      defaults: [],
    });
    expect(candidates.slice(0, 3).map((candidate) => candidate.url)).toEqual([
      "wss://hint-1", "wss://hint-2", "wss://hint-3",
    ]);
    expect(candidates.slice(3, 6).map((candidate) => candidate.url)).toEqual([
      "wss://successful", "wss://configured",
    ]);
  });
});
