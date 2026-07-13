import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  it("truncates the displayed user ID and copies the complete ID", async () => {
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

    expect(document.body).toHaveTextContent("npub1example");
    expect(screen.getByText("npub1example")).toHaveClass("truncate");

    fireEvent.click(screen.getByRole("button", { name: "ユーザーIDをコピー" }));

    expect(writeText).toHaveBeenCalledWith("npub1example");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "ユーザーIDをコピーしました" }),
      ).toBeVisible();
    });
  });
});
