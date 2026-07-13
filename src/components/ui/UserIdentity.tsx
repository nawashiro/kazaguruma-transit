import { formatBip39JapaneseMnemonicPreviewFromPubkey } from "@/lib/nostr/mnemonic-utils";
import { NpubDisplay } from "@/components/ui/NpubDisplay";

interface UserIdentityProps {
  pubkey: string;
}

export function UserIdentity({ pubkey }: UserIdentityProps) {
  return (
    <div className="min-w-0">
      <p>
        <span className="text-base font-bold mr-1">
          {formatBip39JapaneseMnemonicPreviewFromPubkey(pubkey)}
        </span>
        <span className="text-base-content/70">さん</span>
      </p>
      <NpubDisplay pubkey={pubkey} />
    </div>
  );
}
