import fs from "node:fs";
import path from "node:path";
import type { KoFiContent } from "@/types/ko-fi";
import { parseKoFiUsername } from "./ko-fi-config";

const FUNDING_FILE_PATH = path.join(process.cwd(), "FUNDING.yml");
const CONTENT_FILE_PATH = path.join(process.cwd(), "ko-fi-content.json");
const EXAMPLE_CONTENT_FILE_PATH = path.join(
  process.cwd(),
  "ko-fi-content.json.example",
);

/**
 * リポジトリのFUNDING.ymlからKo-fiの支援先を読み込む。
 */
export function loadKoFiUsername(): string | null {
  if (!fs.existsSync(FUNDING_FILE_PATH)) {
    return null;
  }

  return parseKoFiUsername(fs.readFileSync(FUNDING_FILE_PATH, "utf8"));
}

/**
 * ローカル設定を優先してKo-fi支援欄の文言を読み込む。
 */
export function loadKoFiContent(): KoFiContent {
  const contentFilePath = fs.existsSync(CONTENT_FILE_PATH)
    ? CONTENT_FILE_PATH
    : EXAMPLE_CONTENT_FILE_PATH;
  const parsedContent: unknown = JSON.parse(
    fs.readFileSync(contentFilePath, "utf8"),
  );

  if (!isKoFiContent(parsedContent)) {
    throw new Error("Ko-fi支援文言の設定が不正です");
  }

  return parsedContent;
}

function isKoFiContent(value: unknown): value is KoFiContent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const content = value as Record<string, unknown>;

  return (
    typeof content.heading === "string" &&
    content.heading.trim().length > 0 &&
    typeof content.message === "string" &&
    content.message.trim().length > 0
  );
}
