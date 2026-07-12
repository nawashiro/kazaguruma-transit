import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ModeratorManagementSection } from "../ModeratorManagementSection";

jest.mock("@/lib/nostr/mnemonic-utils", () => ({
  formatBip39JapaneseMnemonicPreviewFromPubkey: () => "あいうえお",
}));
jest.mock("@/lib/nostr/nostr-utils", () => ({
  formatRelativeTime: () => "たった今",
  hexToNpub: () => "npub1example",
}));

const pubkey = "a".repeat(64);
const moderator = { pubkey };

describe("ModeratorManagementSection", () => {
  it("shows the complete user ID without a copy action", () => {
    render(
      <ModeratorManagementSection
        moderators={[moderator]}
        applications={[]}
        applicationsByPubkey={new Map()}
        isCreator={false}
        approvedPubkeys={new Set()}
        removedPubkeys={new Set()}
        onToggleApproval={jest.fn()}
        onToggleRemoval={jest.fn()}
      />,
    );

    expect(document.body).toHaveTextContent("npub1example");
    expect(document.querySelector("button")).not.toBeInTheDocument();
  });
});
