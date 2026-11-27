/**
 * 町名と番地の表記は、位置参照情報の「漢数字の丁目」と利用者の入力の
 * 「全角数字・番・号・区名」が混在する。索引の生成と検索の双方が同じ
 * 規則で正規化する必要があるため、ここへ集約する。
 */

const KANJI_DIGITS = "一二三四五六七八九";
const KANJI_CHOME_PATTERN = /([一二三四五六七八九十]+)丁目/gu;

export const PREFECTURE_PREFIX = "千代田区";

export function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/gu, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0xfee0),
  );
}

export function kanjiNumberToArabic(value: string): number | null {
  if (!value) {
    return null;
  }
  if (/^[0-9]+$/u.test(value)) {
    return Number(value);
  }
  if (!/^[一二三四五六七八九十]+$/u.test(value)) {
    return null;
  }
  if (!value.includes("十")) {
    if (value.length !== 1) {
      return null;
    }
    return KANJI_DIGITS.indexOf(value) + 1;
  }
  const parts = value.split("十");
  if (parts.length !== 2) {
    return null;
  }
  const [tensText, onesText] = parts;
  if (tensText.length > 1 || onesText.length > 1) {
    return null;
  }
  const tens = tensText === "" ? 1 : KANJI_DIGITS.indexOf(tensText) + 1;
  const ones = onesText === "" ? 0 : KANJI_DIGITS.indexOf(onesText) + 1;
  if (tensText !== "" && tens === 1) {
    return null;
  }
  return tens * 10 + ones;
}

export function arabicNumberToKanji(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 99) {
    return null;
  }
  const digit = (count: number) =>
    count === 0 ? "" : KANJI_DIGITS[count - 1];
  if (value < 10) {
    return digit(value);
  }
  if (value === 10) {
    return "十";
  }
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return tens === 1 ? `十${digit(ones)}` : `${digit(tens)}十${digit(ones)}`;
}

export interface TownNameParts {
  /** 丁目を除いた町名。丁目を持たない町名では元の文字列。 */
  town: string;
  /** 丁目。丁目を持たない町名では 0。 */
  chome: number;
}

export function splitTownName(name: string): TownNameParts {
  const match = name.match(/^(.*?)([一二三四五六七八九十]+)丁目$/u);
  if (!match) {
    return { town: name, chome: 0 };
  }
  const chome = kanjiNumberToArabic(match[2]);
  if (chome === null) {
    return { town: name, chome: 0 };
  }
  return { town: match[1], chome };
}

/**
 * 入力の揺れを吸収し、`町名[-丁目]-街区` の形へ揃える。
 * 丁目・番・号は区切りとしてのみ扱い、町名の一部（例: 一番町）を
 * 壊さないよう、数字を伴う場合だけ区切りに変える。
 */
export function normalizeAddressQuery(input: string): string {
  return toHalfWidthDigits(input)
    .normalize("NFKC")
    .replace(/\s/gu, "")
    .replace(/^東京都/u, "")
    .replace(new RegExp(`^${PREFECTURE_PREFIX}`, "u"), "")
    .replace(KANJI_CHOME_PATTERN, (_match, chomeText: string) => {
      const chome = kanjiNumberToArabic(chomeText);
      return chome === null ? chomeText : `-${chome}-`;
    })
    .replace(/[−ー－―‐]/gu, "-")
    .replace(/(?<=[0-9-])番地?/gu, "-")
    .replace(/(?<=[0-9-])号/gu, "-")
    .replace(/([^0-9-])([0-9])/gu, "$1-$2")
    .replace(/-+/gu, "-")
    .replace(/^-/u, "")
    .replace(/-$/u, "");
}

export interface AddressQueryParts {
  /** 入力に含まれる町名。丁目は含まない。 */
  town: string;
  /** 町名に続く数字の並び。それぞれの意味は町の構造で決まる。 */
  numbers: string[];
}

/**
 * 正規化済みの入力を町名と数字の並びへ分解する。数字の意味は町が丁目を
 * 持つかで変わるため、ここでは並びを取り出すだけにして、解釈は呼び出し側に
 * 委ねる。町名に `-` を含む町はないため、最初の区切りより前を町名とする。
 */
export function parseAddressQuery(normalized: string): AddressQueryParts | null {
  if (!normalized) {
    return null;
  }
  const [town, ...numbers] = normalized.split("-");
  if (!town) {
    return null;
  }
  if (numbers.some((value) => !/^[0-9]+$/u.test(value))) {
    return null;
  }
  return { town, numbers };
}

/**
 * 名前の検索語を照合用の比較文字列にする。全角と半角、空白の有無、
 * 大文字小文字の違いを吸収する。
 */
export function normalizeSearchTerm(value: string): string {
  return toHalfWidthDigits(value)
    .normalize("NFKC")
    .replace(/\s/gu, "")
    .toLowerCase();
}
