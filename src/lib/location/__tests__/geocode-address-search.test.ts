/** @jest-environment node */

import path from "node:path";

import { loadGeocodeIndex, type GeocodeIndex } from "../geocode-index";
import { GeocodeSearcher } from "../geocode-search";
import { arabicNumberToKanji } from "../geocode-address";

const INDEX_PATH = path.join(process.cwd(), "data", "geocode-index.json");

function loadIndex(): GeocodeIndex {
  const loaded = loadGeocodeIndex(INDEX_PATH);
  if (loaded.status !== "success") {
    throw loaded.error;
  }
  return loaded.index;
}

const index = loadIndex();
const searcher = new GeocodeSearcher(index);

function kanji(value: number): string {
  return arabicNumberToKanji(value) ?? String(value);
}

function blockAddress(block: GeocodeIndex["blocks"][number]): string {
  const chome = block.chome === 0 ? "" : `${kanji(block.chome)}丁目`;
  return `千代田区${block.town}${chome}${block.block}番`;
}

function towns(): string[] {
  return [...new Set(index.blocks.map((block) => block.town))];
}

function chomes(): Array<{ town: string; chome: number }> {
  const seen = new Map<string, { town: string; chome: number }>();
  for (const block of index.blocks) {
    seen.set(`${block.town}|${block.chome}`, { town: block.town, chome: block.chome });
  }
  return [...seen.values()];
}

function housesOf(town: string): boolean {
  return index.blocks.some((block) => block.town === town && block.chome !== 0);
}

function centroidNearest(blocks: GeocodeIndex["blocks"]): GeocodeIndex["blocks"][number] {
  const lat = blocks.reduce((sum, block) => sum + block.lat, 0) / blocks.length;
  const lng = blocks.reduce((sum, block) => sum + block.lng, 0) / blocks.length;
  const scale = Math.cos((lat * Math.PI) / 180);
  return blocks.reduce((best, block) =>
    (block.lat - lat) ** 2 + ((block.lng - lng) * scale) ** 2 <
    (best.lat - lat) ** 2 + ((best.lng - lng) * scale) ** 2
      ? block
      : best,
  );
}

function blocksOfChome(town: string, chome: number): GeocodeIndex["blocks"] {
  return index.blocks.filter((block) => block.town === town && block.chome === chome);
}

function blocksOfTown(town: string): GeocodeIndex["blocks"] {
  return index.blocks.filter((block) => block.town === town);
}

describe("地点索引を使った住所検索", () => {
  it("全街区の住所が自分自身に解決する", () => {
    const unresolved = index.blocks.filter(
      (block) => searcher.search(blockAddress(block))[0]?.name !== blockAddress(block),
    );
    expect(unresolved.map(blockAddress)).toEqual([]);
  });

  it("町名を打った時点で住所候補が返る", () => {
    const missing = towns().filter(
      (town) => !searcher.search(`千代田区${town}`).some((candidate) => candidate.kind === "address"),
    );
    expect(missing).toEqual([]);
  });

  it("住所候補はすべて街区符号を持つ", () => {
    const malformed = towns().flatMap((town) =>
      searcher
        .search(`千代田区${town}`)
        .filter((candidate) => candidate.kind === "address")
        .filter((candidate) => !/^千代田区.+[0-9]+番$/u.test(candidate.address))
        .map((candidate) => `${town}: ${candidate.address}`),
    );
    expect(malformed).toEqual([]);
  });

  it("丁目の代表街区は同じ丁目の住所に逆引きできる", () => {
    const mismatched = chomes()
      .filter(({ chome }) => chome !== 0)
      .flatMap(({ town, chome }) => {
        const label = `千代田区${town}${kanji(chome)}丁目`;
        const representative = centroidNearest(blocksOfChome(town, chome));
        const reversed = searcher.reverse(representative.lat, representative.lng);
        return reversed !== null && reversed.startsWith(label) ? [] : [`${label} -> ${reversed}`];
      });
    expect(mismatched).toEqual([]);
  });

  it("丁目の代表街区は重心に最も近い街区である", () => {
    const mismatched = towns()
      .filter((town) => housesOf(town))
      .flatMap((town) => {
        const expected = blocksOfTown(town)
          .filter((block) => block.chome !== 0)
          .map((block) => block.chome)
          .filter((chome, position, list) => list.indexOf(chome) === position)
          .sort((first, second) => first - second)
          .slice(0, 5)
          .map((chome) => blockAddress(centroidNearest(blocksOfChome(town, chome))));
        const found = searcher
          .search(`千代田区${town}`)
          .filter((candidate) => candidate.kind === "address")
          .map((candidate) => candidate.name);
        return JSON.stringify(found) === JSON.stringify(expected)
          ? []
          : [`${town}: ${found.join(", ")} (期待 ${expected.join(", ")})`];
      });
    expect(mismatched).toEqual([]);
  });

  it("丁目を持たない町の先頭の候補は同じ町の街区である", () => {
    const mismatched = towns()
      .filter((town) => !housesOf(town))
      .flatMap((town) => {
        const first = searcher
          .search(`千代田区${town}`)
          .find((candidate) => candidate.kind === "address");
        return first !== undefined && first.name.startsWith(`千代田区${town}`)
          ? []
          : [`${town} -> ${first?.name}`];
      });
    expect(mismatched).toEqual([]);
  });
});
