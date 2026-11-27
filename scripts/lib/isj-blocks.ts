import {
  kanjiNumberToArabic,
  splitTownName,
} from "../../src/lib/location/geocode-address";
import type { GeocodeBlock } from "../../src/lib/location/geocode-index";
import { decodeShiftJis, readCsvEntry, readZipEntries, splitCsvLine } from "./geocode-zip";

const COLUMN = {
  prefecture: "都道府県名",
  city: "市区町村名",
  chome: "大字・丁目名",
  block: "街区符号・地番",
  latitude: "緯度",
  longitude: "経度",
  representative: "代表フラグ",
} as const;

export interface IsjParseResult {
  blocks: GeocodeBlock[];
  version: string | null;
}

function columnIndexes(header: string[]): Record<keyof typeof COLUMN, number> {
  const indexes = {} as Record<keyof typeof COLUMN, number>;
  for (const [key, name] of Object.entries(COLUMN) as Array<
    [keyof typeof COLUMN, string]
  >) {
    const index = header.indexOf(name);
    if (index === -1) {
      throw new Error(`位置参照情報のCSVに列がありません: ${name}`);
    }
    indexes[key] = index;
  }
  return indexes;
}

export function parseIsjCsv(text: string): IsjParseResult {
  const lines = text.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error("位置参照情報のCSVが空です");
  }
  const header = splitCsvLine(lines[0]);
  const indexes = columnIndexes(header);
  const blocks: GeocodeBlock[] = [];

  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line);
    const chomeName = fields[indexes.chome]?.trim() ?? "";
    const blockName = fields[indexes.block]?.trim() ?? "";
    const latitude = Number(fields[indexes.latitude]);
    const longitude = Number(fields[indexes.longitude]);
    if (
      chomeName.length === 0 ||
      blockName.length === 0 ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }
    const { town, chome } = splitTownName(chomeName);
    blocks.push({
      town,
      chome,
      block: blockName,
      lat: latitude,
      lng: longitude,
      representative: fields[indexes.representative]?.trim() === "1",
    });
  }

  return { blocks, version: null };
}

/**
 * 同じ街区に代表点が複数あるときは、代表フラグの立つ点を1つだけ残す。
 * 代表フラグの立つ点が無ければ先頭を残す。順序は入力順に依存させない。
 */
export function dedupeBlocks(blocks: GeocodeBlock[]): GeocodeBlock[] {
  const byKey = new Map<string, GeocodeBlock>();
  for (const block of blocks) {
    const key = `${block.town}|${block.chome}|${block.block}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, block);
      continue;
    }
    if (block.representative && !existing.representative) {
      byKey.set(key, block);
      continue;
    }
    if (block.representative === existing.representative) {
      const order =
        block.lat - existing.lat || block.lng - existing.lng;
      if (order < 0) {
        byKey.set(key, block);
      }
    }
  }
  return [...byKey.values()].sort(
    (first, second) =>
      first.town.localeCompare(second.town, "ja") ||
      first.chome - second.chome ||
      first.block.localeCompare(second.block, "ja", { numeric: true }),
  );
}

export function readIsjBlocksFromZip(
  zip: Buffer,
  decode: (bytes: Buffer) => string = decodeShiftJis,
): IsjParseResult {
  const entries = readZipEntries(zip);
  const csv = decode(readCsvEntry(entries));
  const parsed = parseIsjCsv(csv);
  const metadata = entries.find((entry) =>
    entry.name.toLowerCase().endsWith(".xml"),
  );
  return {
    blocks: dedupeBlocks(parsed.blocks),
    version: metadata === undefined ? null : entryVersion(metadata.name),
  };
}

function entryVersion(name: string): string | null {
  const match = name.match(/([0-9]{2}\.0a)/u);
  return match === null ? null : match[1];
}

/**
 * 位置参照情報の丁目は漢数字、利用者の入力は算用数字が混在する。
 * 索引に持たせる丁目は数値にして、表示のときにだけ漢数字へ戻す。
 */
export function isjChomeToNumber(chomeName: string): number {
  const match = chomeName.match(/^([一二三四五六七八九十]+)丁目$/u);
  if (match === null) {
    return 0;
  }
  return kanjiNumberToArabic(match[1]) ?? 0;
}
