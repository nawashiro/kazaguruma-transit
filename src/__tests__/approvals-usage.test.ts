import { execSync } from "child_process";

describe("approval retrieval usage", () => {
  it("uses EOSE-based approvals only on the discussion detail page", () => {
    const result = execSync(
      "rg --glob '!**/__tests__/**' getApprovalsOnEose src -l",
      {
        encoding: "utf-8",
      }
    )
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .sort();

    expect(result).toEqual(
      [
        "src/app/discussions/[naddr]/page.tsx",
        "src/lib/nostr/nostr-service.ts",
      ].sort()
    );
  });
});
