/**
 * Public app config is split per environment: app-config.local.json for
 * development and app-config.json for production. Both are ignored files
 * supplied per checkout; APP_CONFIG_ENV is inlined by next.config.ts so the
 * server and client bundles select the same file.
 */
import localAppConfig from "../../../app-config.local.json";
import productionAppConfig from "../../../app-config.json";

export interface DiscussionReadStrategyAppConfig {
  idleTimeoutMs: number;
  hardTimeoutMs: number;
  dedupWindowMs: number;
}

export interface DiscussionAppConfig {
  enabled: boolean;
  adminPubkey: string;
  busStopDiscussionId: string;
  discussionListNaddr: string;
  nostrRelays: string[];
  nostrTimeoutMs: number;
  readStrategy: DiscussionReadStrategyAppConfig;
}

export interface SupportAppConfig {
  enabled: boolean;
  koFiUsername: string;
  heading: string;
  message: string;
}

export interface AnnouncementAppConfig {
  information: string;
  url: string;
}

export interface AppConfig {
  appUrl: string;
  gaMeasurementId: string;
  discussion: DiscussionAppConfig;
  support: SupportAppConfig;
  announcement: AnnouncementAppConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function invalidAppConfig(): never {
  throw new Error("公開アプリ設定の形式が不正です");
}

export function parseAppConfig(value: unknown): AppConfig {
  if (!isRecord(value)) {
    return invalidAppConfig();
  }

  const discussion = value.discussion;
  const support = value.support;
  const announcement = value.announcement;
  if (
    !isRecord(discussion) ||
    !isRecord(support) ||
    !isRecord(announcement)
  ) {
    return invalidAppConfig();
  }

  const readStrategy = discussion.readStrategy;
  if (!isRecord(readStrategy)) {
    return invalidAppConfig();
  }

  if (
    typeof value.appUrl !== "string" ||
    typeof value.gaMeasurementId !== "string" ||
    typeof discussion.enabled !== "boolean" ||
    typeof discussion.adminPubkey !== "string" ||
    typeof discussion.busStopDiscussionId !== "string" ||
    typeof discussion.discussionListNaddr !== "string" ||
    !isStringArray(discussion.nostrRelays) ||
    !isFiniteNumber(discussion.nostrTimeoutMs) ||
    !isFiniteNumber(readStrategy.idleTimeoutMs) ||
    !isFiniteNumber(readStrategy.hardTimeoutMs) ||
    !isFiniteNumber(readStrategy.dedupWindowMs) ||
    typeof support.enabled !== "boolean" ||
    typeof support.koFiUsername !== "string" ||
    !isNonEmptyString(support.heading) ||
    !isNonEmptyString(support.message) ||
    !isNonEmptyString(announcement.information) ||
    !isNonEmptyString(announcement.url)
  ) {
    return invalidAppConfig();
  }

  return {
    appUrl: value.appUrl,
    gaMeasurementId: value.gaMeasurementId,
    discussion: {
      enabled: discussion.enabled,
      adminPubkey: discussion.adminPubkey,
      busStopDiscussionId: discussion.busStopDiscussionId,
      discussionListNaddr: discussion.discussionListNaddr,
      nostrRelays: discussion.nostrRelays,
      nostrTimeoutMs: discussion.nostrTimeoutMs,
      readStrategy: {
        idleTimeoutMs: readStrategy.idleTimeoutMs,
        hardTimeoutMs: readStrategy.hardTimeoutMs,
        dedupWindowMs: readStrategy.dedupWindowMs,
      },
    },
    support: {
      enabled: support.enabled,
      koFiUsername: support.koFiUsername,
      heading: support.heading,
      message: support.message,
    },
    announcement: {
      information: announcement.information,
      url: announcement.url,
    },
  };
}

export const appConfig = parseAppConfig(
  process.env.APP_CONFIG_ENV === "production"
    ? productionAppConfig
    : localAppConfig,
);

export default appConfig;
