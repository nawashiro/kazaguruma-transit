import { selectRelayCandidates } from "@/lib/discussion/relay-candidate-selector";

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
});
