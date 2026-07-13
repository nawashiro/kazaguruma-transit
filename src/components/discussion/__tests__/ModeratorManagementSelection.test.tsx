import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ModeratorManagementSection } from "../ModeratorManagementSection";

jest.mock("@/lib/nostr/mnemonic-utils", () => ({
  formatBip39JapaneseMnemonicPreviewFromPubkey: () => "あいうえお",
}));
jest.mock("@/lib/nostr/nostr-utils", () => ({
  formatRelativeTime: () => "たった今",
  hexToNpub: () => "npub1example",
}));

const applicantPubkey = "a".repeat(64);
const application = {
  id: "application-1",
  applicantPubkey,
  createdAt: 1,
  reason: "活動方針に共感したため",
  event: {
    id: "application-1",
    kind: 1111,
    pubkey: applicantPubkey,
    created_at: 1,
    content: "活動方針に共感したため",
    tags: [],
    sig: "signature",
  },
};

describe("ModeratorManagementSection selection", () => {
  it("keeps the approval checkbox available when the application reason is displayed", () => {
    render(
      <ModeratorManagementSection
        moderators={[]}
        applications={[application]}
        applicationsByPubkey={new Map()}
        isCreator
        approvedPubkeys={new Set()}
        removedPubkeys={new Set()}
        onToggleApproval={jest.fn()}
        onToggleRemoval={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("checkbox", {
        name: "あいうえお を許可対象にする",
      }),
    ).toBeVisible();
    expect(screen.getByText("申請理由: 活動方針に共感したため")).toBeVisible();
  });
});
