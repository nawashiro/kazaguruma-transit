import {
  formatBip39JapaneseMnemonicPreview,
  formatBip39JapaneseMnemonicPreviewFromPubkey,
} from "@/lib/nostr/mnemonic-utils";

describe("mnemonic-utils", () => {
  it("先頭3語のみを返す", () => {
    const value = formatBip39JapaneseMnemonicPreview(
      "あいこくしん いさましい うけつけ えいわ がいとう"
    );
    expect(value).toBe("あいこくしん いさましい うけつけ");
  });

  it("余分な空白を除去して先頭3語のみを返す", () => {
    const value = formatBip39JapaneseMnemonicPreview(
      "  あいこくしん   いさましい \n うけつけ \t えいわ "
    );
    expect(value).toBe("あいこくしん いさましい うけつけ");
  });

  it("pubkeyから日本語3語を決定的に導出する", () => {
    const pubkey = "f".repeat(64);
    const first = formatBip39JapaneseMnemonicPreviewFromPubkey(pubkey);
    const second = formatBip39JapaneseMnemonicPreviewFromPubkey(pubkey);

    expect(first).toBe(second);
    expect(first.split(" ")).toHaveLength(3);
    expect(first.split(" ").every((word) => word.length > 0)).toBe(true);
  });
});
