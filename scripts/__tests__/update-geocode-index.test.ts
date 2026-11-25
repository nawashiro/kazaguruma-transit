import { deflateRawSync } from "node:zlib";

import {
  decodeShiftJis,
  readCsvEntry,
  readZipEntries,
  splitCsvLine,
} from "../lib/geocode-zip";
import {
  dedupeBlocks,
  parseIsjCsv,
  readIsjBlocksFromZip,
} from "../lib/isj-blocks";
import type { GeocodeBlock } from "../../src/lib/location/geocode-index";

const HEADER = [
  "都道府県名",
  "市区町村名",
  "大字・丁目名",
  "小字・通称名",
  "街区符号・地番",
  "座標系番号",
  "Ｘ座標",
  "Ｙ座標",
  "緯度",
  "経度",
  "住居表示フラグ",
  "代表フラグ",
  "更新前履歴フラグ",
  "更新後履歴フラグ",
];

function csvLine(values: string[]): string {
  return values.map((value) => `"${value}"`).join(",");
}

function csvBytes(rows: string[][]): Buffer {
  const text = [HEADER, ...rows].map(csvLine).join("\r\n") + "\r\n";
  return Buffer.from(new TextEncoder().encode(text));
}

function buildZip(entries: Array<{ name: string; bytes: Buffer; deflate: boolean }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const payload = entry.deflate ? deflateRawSync(entry.bytes) : entry.bytes;
    const method = entry.deflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(entry.bytes.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBytes, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(entry.bytes.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);

    offset += local.length + nameBytes.length + payload.length;
  }

  const centralSize = centrals.reduce((total, chunk) => total + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, ...centrals, end]);
}

const ROWS = [
  ["東京都", "千代田区", "霞が関一丁目", "", "1", "9", "0", "0", "35.675110", "139.752594", "1", "1", "0", "0"],
  ["東京都", "千代田区", "霞が関一丁目", "", "2", "9", "0", "0", "35.675300", "139.752900", "1", "1", "0", "0"],
  ["東京都", "千代田区", "霞が関一丁目", "", "1", "9", "0", "0", "35.675120", "139.752600", "1", "0", "0", "0"],
  ["東京都", "千代田区", "神田和泉町", "", "1", "9", "0", "0", "35.699191", "139.775976", "1", "1", "0", "0"],
  ["東京都", "千代田区", "隼町", "", "4", "9", "0", "0", "35.680663", "139.743412", "1", "1", "0", "0"],
];

describe("parseIsjCsv", () => {
  it("丁目の有無を町名と数値の丁目に分ける", () => {
    const { blocks } = parseIsjCsv(
      [HEADER, ...ROWS].map(csvLine).join("\n"),
    );
    expect(blocks).toContainEqual({
      town: "霞が関",
      chome: 1,
      block: "1",
      lat: 35.67511,
      lng: 139.752594,
      representative: true,
    });
    expect(blocks).toContainEqual({
      town: "神田和泉町",
      chome: 0,
      block: "1",
      lat: 35.699191,
      lng: 139.775976,
      representative: true,
    });
  });

  it("列が欠けたCSVを拒否する", () => {
    expect(() => parseIsjCsv('"都道府県名","市区町村名"\n')).toThrow(/列がありません/);
  });

  it("空のCSVを拒否する", () => {
    expect(() => parseIsjCsv("")).toThrow(/空です/);
  });
});

describe("dedupeBlocks", () => {
  it("同じ街区は代表フラグの立つ点だけ残す", () => {
    const blocks: GeocodeBlock[] = [
      { town: "霞が関", chome: 1, block: "1", lat: 35.67512, lng: 139.7526, representative: false },
      { town: "霞が関", chome: 1, block: "1", lat: 35.67511, lng: 139.752594, representative: true },
    ];
    expect(dedupeBlocks(blocks)).toEqual([
      { town: "霞が関", chome: 1, block: "1", lat: 35.67511, lng: 139.752594, representative: true },
    ]);
  });

  it("代表フラグが無い街区は座標の小さい点を残す", () => {
    const blocks: GeocodeBlock[] = [
      { town: "隼町", chome: 0, block: "4", lat: 35.6807, lng: 139.7435, representative: false },
      { town: "隼町", chome: 0, block: "4", lat: 35.6806, lng: 139.7434, representative: false },
    ];
    expect(dedupeBlocks(blocks)[0]?.lat).toBe(35.6806);
  });

  it("町名・丁目・街区の順に並べる", () => {
    const blocks: GeocodeBlock[] = [
      { town: "隼町", chome: 0, block: "4", lat: 1, lng: 1, representative: true },
      { town: "霞が関", chome: 2, block: "1", lat: 1, lng: 1, representative: true },
      { town: "霞が関", chome: 1, block: "10", lat: 1, lng: 1, representative: true },
      { town: "霞が関", chome: 1, block: "2", lat: 1, lng: 1, representative: true },
    ];
    expect(dedupeBlocks(blocks).map((block) => `${block.town}${block.chome}-${block.block}`)).toEqual([
      "霞が関1-2",
      "霞が関1-10",
      "霞が関2-1",
      "隼町0-4",
    ]);
  });
});

describe("readZipEntries", () => {
  it("無圧縮と deflate の両方を読める", () => {
    const zip = buildZip([
      { name: "a.csv", bytes: Buffer.from("stored"), deflate: false },
      { name: "b.csv", bytes: Buffer.from("deflated"), deflate: true },
    ]);
    const entries = readZipEntries(zip);
    expect(entries).toHaveLength(2);
    expect(entries[0].bytes.toString("utf8")).toBe("stored");
    expect(entries[1].bytes.toString("utf8")).toBe("deflated");
  });

  it("CSVだけを取り出す", () => {
    const zip = buildZip([
      { name: "dir/", bytes: Buffer.alloc(0), deflate: false },
      { name: "dir/data.csv", bytes: Buffer.from("x"), deflate: true },
      { name: "dir/meta.xml", bytes: Buffer.from("y"), deflate: true },
    ]);
    expect(readCsvEntry(readZipEntries(zip)).toString("utf8")).toBe("x");
  });

  it("CSVが無ければ失敗する", () => {
    const zip = buildZip([{ name: "a.xml", bytes: Buffer.from("x"), deflate: false }]);
    expect(() => readCsvEntry(readZipEntries(zip))).toThrow(/CSV/);
  });
});

describe("splitCsvLine", () => {
  it("引用符で囲まれたカンマを項目内として扱う", () => {
    expect(splitCsvLine('"a,b","c","d"')).toEqual(["a,b", "c", "d"]);
  });

  it("二重引用符を1つに戻す", () => {
    expect(splitCsvLine('"say ""hi""",x')).toEqual(['say "hi"', "x"]);
  });
});

describe("readIsjBlocksFromZip", () => {
  const utf8 = (text: string) => Buffer.from(text, "utf8");
  const text = [HEADER, ...ROWS].map(csvLine).join("\r\n") + "\r\n";
  const zip = buildZip([
    { name: "13101-24.0a/", bytes: Buffer.alloc(0), deflate: false },
    { name: "13101-24.0a/13101_2025.csv", bytes: utf8(text), deflate: true },
    { name: "13101-24.0a/md_13101_2025.xml", bytes: utf8("<x/>"), deflate: true },
  ]);
  const asUtf8 = (bytes: Buffer) => bytes.toString("utf8");

  it("CSVを読み、代表点へ畳んで版を拾う", () => {
    const result = readIsjBlocksFromZip(zip, asUtf8);
    expect(result.version).toBe("24.0a");
    expect(result.blocks).toHaveLength(4);
    const kasumigaseki = result.blocks.find(
      (block) => block.town === "霞が関" && block.chome === 1 && block.block === "1",
    );
    expect(kasumigaseki).toMatchObject({ lat: 35.67511, representative: true });
    expect(result.blocks.find((block) => block.town === "隼町")).toMatchObject({
      chome: 0,
      block: "4",
    });
  });

  it("列を読めないデコード結果では失敗する", () => {
    expect(() =>
      readIsjBlocksFromZip(zip, () => "\ufffd\ufffd"),
    ).toThrow(/列がありません/);
  });
});

describe("decodeShiftJis", () => {
  it("Shift_JIS のバイト列を日本語として読む", () => {
    expect(decodeShiftJis(Buffer.from([0x93, 0x8c, 0x8b, 0x9e]))).toBe("東京");
  });
});
