import { render, screen } from "@testing-library/react";
import { UserIdentity } from "../UserIdentity";

const npub = `npub1${"a".repeat(58)}`;

jest.mock("@/lib/nostr/mnemonic-utils", () => ({
  formatBip39JapaneseMnemonicPreviewFromPubkey: () => "あいうえお かきくけこ さしすせそ",
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  hexToNpub: () => `npub1${"a".repeat(58)}`,
}));

describe("UserIdentity", () => {
  it("renders the mnemonic name and the shortened NpubDisplay in the moderators style", () => {
    render(<UserIdentity pubkey="pubkey" />);

    const name = screen.getByText("あいうえお かきくけこ さしすせそ");
    expect(name).toHaveClass("text-base", "font-bold", "mr-1");
    expect(screen.getByText("さん")).toHaveClass("text-base-content");
    expect(screen.getByText("npub1aaaa…")).toBeInTheDocument();
    expect(screen.queryByText(npub)).not.toBeInTheDocument();
  });
});
