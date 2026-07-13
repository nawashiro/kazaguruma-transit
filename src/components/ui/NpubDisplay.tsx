"use client";

import { useState } from "react";
import { hexToNpub } from "@/lib/nostr/nostr-utils";
import { logger } from "@/utils/logger";

interface Props {
  pubkey: string;
}

export function NpubDisplay({ pubkey }: Props) {
  const [isCopied, setIsCopied] = useState(false);
  const npub = hexToNpub(pubkey);

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
        className="shrink-0 rounded p-1 transition-colors hover:bg-base-200"
        title={isCopied ? "ユーザーIDをコピーしました" : "クリップボードにコピー"}
        aria-label={isCopied ? "ユーザーIDをコピーしました" : "ユーザーIDをコピー"}
      >
        {isCopied ? (
          <svg className="h-4 w-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-base-content/60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
