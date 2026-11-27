import { inflateRawSync } from "node:zlib";

/**
 * 位置参照情報の配布物は、Shift_JIS のCSVを格納したZIP1ファイルだけである。
 * 汎用のZIP処理を持ち込むほどではないため、中央ディレクトリを読んで
 * 必要なエントリだけを取り出す最小の読み取りをここに置く。
 */

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const STORE_METHOD = 0;
const DEFLATE_METHOD = 8;

export interface ZipEntry {
  name: string;
  bytes: Buffer;
}

export interface ZipReadError {
  reason: string;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  throw new Error("ZIPの終端レコードが見つかりません");
}

export function readZipEntries(buffer: Buffer): ZipEntry[] {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new Error(`ZIPの中央ディレクトリが壊れています: ${index}`);
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");

    if (buffer.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) {
      throw new Error(`ZIPのローカルヘッダーが壊れています: ${name}`);
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart =
      localOffset + 30 + localNameLength + localExtraLength;
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    if (!name.endsWith("/")) {
      if (method === STORE_METHOD) {
        entries.push({ name, bytes: Buffer.from(data) });
      } else if (method === DEFLATE_METHOD) {
        entries.push({ name, bytes: inflateRawSync(data) });
      } else {
        throw new Error(`未対応のZIP圧縮方式です: ${name} (${method})`);
      }
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

export function readCsvEntry(entries: ZipEntry[]): Buffer {
  const csv = entries.find((entry) => entry.name.toLowerCase().endsWith(".csv"));
  if (csv === undefined) {
    throw new Error("ZIPにCSVが含まれていません");
  }
  return csv.bytes;
}

export function decodeShiftJis(bytes: Buffer): string {
  return new TextDecoder("shift_jis", { fatal: false }).decode(bytes);
}

/**
 * CSVの1行を、引用符で囲まれたカンマを含めて分割する。位置参照情報は
 * 全ての項目を引用符で囲むため、素朴な split では壊れる。
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
      continue;
    }
    if (character === ",") {
      fields.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  fields.push(current);
  return fields;
}
