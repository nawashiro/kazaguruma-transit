import { createHash } from "crypto";
import { bip39JapaneseWordlist } from "@/lib/nostr/bip39-japanese-wordlist";

const PREVIEW_WORD_COUNT = 3;

export function formatBip39JapaneseMnemonicPreview(mnemonic: string): string {
  return mnemonic
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, PREVIEW_WORD_COUNT)
    .join(" ");
}

export function formatBip39JapaneseMnemonicPreviewFromPubkey(
  pubkey: string
): string {
  const digest = createHash("sha256")
    .update(pubkey.trim().toLowerCase())
    .digest();

  const words: string[] = [];
  for (let i = 0; i < PREVIEW_WORD_COUNT; i += 1) {
    const n = (digest[i * 2] << 8) + digest[i * 2 + 1];
    const index = n % bip39JapaneseWordlist.length;
    words.push(bip39JapaneseWordlist[index]);
  }

  return words.join(" ");
}
