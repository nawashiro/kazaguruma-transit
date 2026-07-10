import type { NostrServiceConfig } from "@/lib/nostr/nostr-service";
import { normalizeDiscussionId } from "@/lib/nostr/naddr-utils";
import { getAdminPubkeyHex } from "../nostr/nostr-utils";

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
  relayLimit: number;
  idleTimeoutMs: number;
  hardTimeoutMs: number;
  dedupWindowMs: number;
}

const parseBoundedInteger = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number
): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

export function buildDiscussionId(adminPubkey: string, idPart: string): string {
  return `${DISCUSSION_KIND}:${adminPubkey}:${idPart}`;
}

function resolveDiscussionId(
  discussionIdOrNaddr: string,
  adminPubkey: string
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

function parseRelays(relayString: string) {
  if (!relayString) return [];

  return relayString.split(",").map((url) => ({
    url: url.trim(),
    read: true,
    write: true,
  }));
}

// Removed parseModerators function as NEXT_PUBLIC_MODERATORS is no longer used

export function getBusStopDiscussionConfig(): { naddr: string | null } {
  const naddrString = process.env.NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID;

  if (!naddrString) {
    return { naddr: null };
  }

  // Validate naddr format
  if (!naddrString.startsWith("naddr1")) {
    throw new Error("Invalid naddr format");
  }

  return { naddr: naddrString };
}

export function getDiscussionListConfig(): { naddr: string | null; kind: number; enabled: boolean } {
  const naddrString = process.env.NEXT_PUBLIC_DISCUSSION_LIST_NADDR;

  if (!naddrString) {
    return { naddr: null, kind: 34550, enabled: false };
  }

  // Validate naddr format
  if (!naddrString.startsWith("naddr1")) {
    throw new Error("Invalid naddr format for discussion list");
  }

  return { naddr: naddrString, kind: 34550, enabled: true };
}

export function getDiscussionConfig(): DiscussionConfig {
  const enabled = process.env.NEXT_PUBLIC_DISCUSSIONS_ENABLED === "true";
  const adminPubkey = getAdminPubkeyHex();
  const busStopDiscussionIdPart =
    process.env.NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID || "";
  // NEXT_PUBLIC_MODERATORS removed - moderators are now managed per discussion
  const relayString =
    process.env.NEXT_PUBLIC_NOSTR_RELAYS ||
    "wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol";

  const busStopDiscussionId = resolveDiscussionId(
    busStopDiscussionIdPart,
    adminPubkey
  );

  const parsedTimeout = Number(process.env.NEXT_PUBLIC_NOSTR_TIMEOUT_MS);
  const defaultTimeout = Number.isFinite(parsedTimeout) ? parsedTimeout : 5000;

  return {
    enabled,
    adminPubkey,
    busStopDiscussionId,
    moderators: [], // Global moderators removed
    defaultTimeout,
    relays: parseRelays(relayString),
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
  const fallbackIdleTimeoutMs = getDiscussionConfig().defaultTimeout;
  const idleTimeoutMs = parseBoundedInteger(
    process.env.NEXT_PUBLIC_DISCUSSION_READ_IDLE_TIMEOUT_MS,
    fallbackIdleTimeoutMs,
    250,
    30_000
  );
  const configuredHardTimeoutMs = parseBoundedInteger(
    process.env.NEXT_PUBLIC_DISCUSSION_READ_HARD_TIMEOUT_MS,
    idleTimeoutMs * 3,
    idleTimeoutMs + 1,
    90_000
  );

  return {
    relayLimit: parseBoundedInteger(
      process.env.NEXT_PUBLIC_DISCUSSION_READ_RELAY_LIMIT,
      3,
      1,
      3
    ),
    idleTimeoutMs,
    hardTimeoutMs: Math.max(configuredHardTimeoutMs, idleTimeoutMs + 1),
    dedupWindowMs: parseBoundedInteger(
      process.env.NEXT_PUBLIC_DISCUSSION_READ_DEDUP_WINDOW_MS,
      250,
      0,
      10_000
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
    return errors; // No validation needed if disabled
  }

  if (!config.adminPubkey) {
    errors.push("NEXT_PUBLIC_ADMIN_PUBKEY is required");
  } else if (config.adminPubkey.length !== 64) {
    errors.push("NEXT_PUBLIC_ADMIN_PUBKEY must be 64 characters");
  }

  if (!config.busStopDiscussionId) {
    errors.push("NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID is required");
  }

  if (config.relays.length === 0) {
    errors.push("At least one Nostr relay must be configured");
  }

  // Global moderators validation removed - moderators are now managed per discussion

  return errors;
}

// Default moderators list for development
export const DEFAULT_MODERATORS = [
  // Add your moderator public keys here during development
];

// Default relay list
export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
  "wss://relay.snort.social",
  "wss://nostr.wine",
];
