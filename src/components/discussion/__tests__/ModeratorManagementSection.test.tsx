import { fireEvent, render, screen } from "@testing-library/react";
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
  it("shows a copy operation for each complete user ID", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

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

    fireEvent.click(screen.getByRole("button", { name: "ユーザーID npub1example をコピー" }));

    expect(writeText).toHaveBeenCalledWith("npub1example");
    expect(await screen.findByRole("status")).toHaveTextContent("ユーザーIDをコピーしました");
  });
});
