import type { KoFiContent } from "@/types/ko-fi";
import { appConfig } from "./app-config";

/**
 * 公開app-config.jsonからKo-fiの支援先を読み込む。
 */
export function loadKoFiUsername(): string | null {
  const username = appConfig.support.koFiUsername.trim();
  return appConfig.support.enabled && username ? username : null;
}

/**
 * 公開app-config.jsonからKo-fi支援欄の文言を読み込む。
 */
export function loadKoFiContent(): KoFiContent {
  return {
    heading: appConfig.support.heading,
    message: appConfig.support.message,
  };
}
