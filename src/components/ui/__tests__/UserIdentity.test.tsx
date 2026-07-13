import { render, screen } from "@testing-library/react";
import { UserIdentity } from "../UserIdentity";

jest.mock("@/lib/nostr/mnemonic-utils", () => ({
  formatBip39JapaneseMnemonicPreviewFromPubkey: () => "あいうえお かきくけこ さしすせそ",
}));

jest.mock("@/lib/nostr/nostr-utils", () => ({
  hexToNpub: () => "npub1example",
}));

describe("UserIdentity", () => {
  it("renders the mnemonic name and NpubDisplay in the moderators style", () => {
    render(<UserIdentity pubkey="pubkey" />);

    const name = screen.getByText("あいうえお かきくけこ さしすせそ");
    expect(name).toHaveClass("text-base", "font-bold", "mr-1");
    expect(screen.getByText("さん")).toHaveClass("text-base-content/70");
    expect(screen.getByText("npub1example")).toBeInTheDocument();
  });
});
