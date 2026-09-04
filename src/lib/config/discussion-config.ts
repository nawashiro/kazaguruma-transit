import type { NostrServiceConfig } from "@/lib/nostr/nostr-service";
import { normalizeDiscussionId } from "@/lib/nostr/naddr-utils";
import { getAdminPubkeyHex } from "../nostr/nostr-utils";
import { appConfig } from "./app-config";

const DISCUSSION_KIND = 34550;

export interface DiscussionConfig {
  enabled: boolean;
  adminPubkey: string;
  busStopDiscussionId: string;
  moderators: string[];
  defaultTimeout: number;
  relays: {
    url: string;
    read: boolean;
    write: boolean;
  }[];
}

export interface DiscussionReadStrategyConfig {
  idleTimeoutMs: number;
  hardTimeoutMs: number;
  dedupWindowMs: number;
}

const parseBoundedInteger = (
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (typeof value !== "number" || !Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

const getDefaultTimeout = (): number => appConfig.discussion.nostrTimeoutMs;

export function buildDiscussionId(adminPubkey: string, idPart: string): string {
  return `${DISCUSSION_KIND}:${adminPubkey}:${idPart}`;
}

function resolveDiscussionId(
  discussionIdOrNaddr: string,
  adminPubkey: string,
): string {
  if (!discussionIdOrNaddr) return "";
  const trimmed = discussionIdOrNaddr.trim();
  if (!trimmed) return "";
  const normalizedInput = trimmed.startsWith("nostr:")
    ? trimmed.slice("nostr:".length)
    : trimmed;

  if (normalizedInput.startsWith("naddr1") || normalizedInput.includes(":")) {
    return normalizeDiscussionId(normalizedInput);
  }

  if (!adminPubkey) {
    return "";
  }

  return buildDiscussionId(adminPubkey, normalizedInput);
}

function parseRelays(relayUrls: string[]) {
  return relayUrls.map((url) => ({
    url,
    read: true,
    write: true,
  }));
}

export function getBusStopDiscussionConfig(): { naddr: string | null } {
  const naddrString = appConfig.discussion.busStopDiscussionId;

  if (!naddrString) {
    return { naddr: null };
  }

  if (!naddrString.startsWith("naddr1")) {
    throw new Error("Invalid naddr format");
  }

  return { naddr: naddrString };
}

export function getDiscussionListConfig(): {
  naddr: string | null;
  kind: number;
  enabled: boolean;
} {
  const naddrString = appConfig.discussion.discussionListNaddr;

  if (!naddrString) {
    return { naddr: null, kind: DISCUSSION_KIND, enabled: false };
  }

  if (!naddrString.startsWith("naddr1")) {
    throw new Error("Invalid naddr format for discussion list");
  }

  return { naddr: naddrString, kind: DISCUSSION_KIND, enabled: true };
}

export function getDiscussionConfig(): DiscussionConfig {
  const discussion = appConfig.discussion;
  const adminPubkey = getAdminPubkeyHex();
  const busStopDiscussionId = resolveDiscussionId(
    discussion.busStopDiscussionId,
    adminPubkey,
  );

  return {
    enabled: discussion.enabled,
    adminPubkey,
    busStopDiscussionId,
    moderators: [],
    defaultTimeout: getDefaultTimeout(),
    relays: parseRelays(discussion.nostrRelays),
  };
}

export function getNostrServiceConfig(): NostrServiceConfig {
  const config = getDiscussionConfig();

  return {
    relays: config.relays,
    defaultTimeout: config.defaultTimeout,
  };
}

export function getDiscussionReadStrategyConfig(): DiscussionReadStrategyConfig {
  const configured = appConfig.discussion.readStrategy;
  const fallbackIdleTimeoutMs = getDefaultTimeout();
  const idleTimeoutMs = parseBoundedInteger(
    configured.idleTimeoutMs,
    fallbackIdleTimeoutMs,
    250,
    30_000,
  );
  const configuredHardTimeoutMs = parseBoundedInteger(
    configured.hardTimeoutMs,
    idleTimeoutMs * 3,
    idleTimeoutMs + 1,
    90_000,
  );

  return {
    idleTimeoutMs,
    hardTimeoutMs: Math.max(configuredHardTimeoutMs, idleTimeoutMs + 1),
    dedupWindowMs: parseBoundedInteger(
      configured.dedupWindowMs,
      250,
      0,
      10_000,
    ),
  };
}

export function isDiscussionsEnabled(): boolean {
  const discussionEnabled = getDiscussionConfig().enabled;
  const listEnabled = getDiscussionListConfig().enabled;
  return discussionEnabled && listEnabled;
}

export function validateDiscussionConfig(): string[] {
  const errors: string[] = [];
  const config = getDiscussionConfig();

  if (!config.enabled) {
    return errors;
  }

  if (!config.adminPubkey) {
    errors.push("管理者公開鍵が必要です");
  } else if (config.adminPubkey.length !== 64) {
    errors.push("管理者公開鍵は64文字で指定してください");
  }

  if (!config.busStopDiscussionId) {
    errors.push("バス停会話識別子が必要です");
  }

  if (config.relays.length === 0) {
    errors.push("Nostrリレーを1件以上設定してください");
  }

  return errors;
}
