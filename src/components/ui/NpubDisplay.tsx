"use client";

import { useState } from "react";
import { CheckIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { hexToNpub } from "@/lib/nostr/nostr-utils";
import { logger } from "@/utils/logger";

interface Props {
  pubkey: string;
}

export function NpubDisplay({ pubkey }: Props) {
  const [isCopied, setIsCopied] = useState(false);
  const npub = pubkey.startsWith("npub1") ? pubkey : hexToNpub(pubkey);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(npub);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      logger.error("Failed to copy npub:", error);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-mono text-base-content/70" title={npub}>
        {npub}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex shrink-0 min-h-[44px] min-w-[44px] items-center justify-center rounded-full dark:rounded-sm p-2 transition-colors hover:bg-base-200"
        title={isCopied ? "ユーザーIDをコピーしました" : "クリップボードにコピー"}
        aria-label={isCopied ? "ユーザーIDをコピーしました" : "ユーザーIDをコピー"}
      >
        {isCopied ? (
          <CheckIcon className="h-5 w-5 text-success" aria-hidden="true" />
        ) : (
          <ClipboardDocumentIcon className="h-5 w-5 text-base-content/60" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
