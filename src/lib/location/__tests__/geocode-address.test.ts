import {
  arabicNumberToKanji,
  kanjiNumberToArabic,
  normalizeAddressQuery,
  normalizeSearchTerm,
  parseAddressQuery,
  splitTownName,
  toHalfWidthDigits,
} from "../geocode-address";

describe("splitTownName", () => {
  it("丁目を持つ町名を町名と丁目に分ける", () => {
    expect(splitTownName("霞が関一丁目")).toEqual({ town: "霞が関", chome: 1 });
    expect(splitTownName("神田駿河台二丁目")).toEqual({
      town: "神田駿河台",
      chome: 2,
    });
    expect(splitTownName("九段北四丁目")).toEqual({ town: "九段北", chome: 4 });
  });

  it("十を含む丁目を数値にする", () => {
    expect(splitTownName("神田小川町十一丁目")).toEqual({
      town: "神田小川町",
      chome: 11,
    });
    expect(splitTownName("大手町二十一丁目")).toEqual({
      town: "大手町",
      chome: 21,
    });
  });

  it("丁目を持たない町名はそのまま返す", () => {
    expect(splitTownName("神田和泉町")).toEqual({ town: "神田和泉町", chome: 0 });
    expect(splitTownName("隼町")).toEqual({ town: "隼町", chome: 0 });
    expect(splitTownName("一番町")).toEqual({ town: "一番町", chome: 0 });
    expect(splitTownName("北の丸公園")).toEqual({ town: "北の丸公園", chome: 0 });
  });
});

describe("kanjiNumberToArabic", () => {
  it("一から九を数値にする", () => {
    expect(kanjiNumberToArabic("一")).toBe(1);
    expect(kanjiNumberToArabic("九")).toBe(9);
  });

  it("十を含む数を数値にする", () => {
    expect(kanjiNumberToArabic("十")).toBe(10);
    expect(kanjiNumberToArabic("十一")).toBe(11);
    expect(kanjiNumberToArabic("二十")).toBe(20);
    expect(kanjiNumberToArabic("二十三")).toBe(23);
  });

  it("解釈できない値には null を返す", () => {
    expect(kanjiNumberToArabic("")).toBeNull();
    expect(kanjiNumberToArabic("十十")).toBeNull();
    expect(kanjiNumberToArabic("一十")).toBeNull();
    expect(kanjiNumberToArabic("一一")).toBeNull();
    expect(kanjiNumberToArabic("abc")).toBeNull();
  });
});

describe("arabicNumberToKanji", () => {
  it("漢数字表記へ戻す", () => {
    expect(arabicNumberToKanji(1)).toBe("一");
    expect(arabicNumberToKanji(10)).toBe("十");
    expect(arabicNumberToKanji(11)).toBe("十一");
    expect(arabicNumberToKanji(23)).toBe("二十三");
  });

  it("範囲外には null を返す", () => {
    expect(arabicNumberToKanji(0)).toBeNull();
    expect(arabicNumberToKanji(100)).toBeNull();
  });
});

describe("toHalfWidthDigits", () => {
  it("全角数字を半角にする", () => {
    expect(toHalfWidthDigits("１２３")).toBe("123");
  });
});

describe("normalizeAddressQuery", () => {
  it("漢数字の丁目・番・号を区切りの形に揃える", () => {
    expect(normalizeAddressQuery("霞が関一丁目1番")).toBe("霞が関-1-1");
    expect(normalizeAddressQuery("神田駿河台二丁目5番")).toBe("神田駿河台-2-5");
  });

  it("全角数字と長音記号を吸収する", () => {
    expect(normalizeAddressQuery("霞が関１−１")).toBe("霞が関-1-1");
    expect(normalizeAddressQuery("霞が関１ー１")).toBe("霞が関-1-1");
  });

  it("千代田区と東京都の接頭辞を除く", () => {
    expect(normalizeAddressQuery("千代田区神田和泉町1番地")).toBe(
      "神田和泉町-1",
    );
    expect(normalizeAddressQuery("東京都千代田区隼町4")).toBe("隼町-4");
  });

  it("丁目の無い町名の番地も町名と街区に分ける", () => {
    expect(normalizeAddressQuery("一番町25")).toBe("一番町-25");
    expect(normalizeAddressQuery("皇居外苑1-1")).toBe("皇居外苑-1-1");
  });

  it("区切り記号を1つにまとめ、端の区切りを落とす", () => {
    expect(normalizeAddressQuery("神田神保町1-1")).toBe("神田神保町-1-1");
    expect(normalizeAddressQuery("神田錦町--1")).toBe("神田錦町-1");
    expect(normalizeAddressQuery("神田錦町1-")).toBe("神田錦町-1");
  });

  it("空文字には空文字を返す", () => {
    expect(normalizeAddressQuery("")).toBe("");
    expect(normalizeAddressQuery("千代田区")).toBe("");
  });
});

describe("parseAddressQuery", () => {
  it("町名に続く数字を並びのまま取り出す", () => {
    expect(parseAddressQuery("霞が関-1-1")).toEqual({
      town: "霞が関",
      numbers: ["1", "1"],
    });
    expect(parseAddressQuery("隼町-4-1")).toEqual({
      town: "隼町",
      numbers: ["4", "1"],
    });
  });

  it("数字を持たない町名は空の並びを返す", () => {
    expect(parseAddressQuery("神田和泉町")).toEqual({
      town: "神田和泉町",
      numbers: [],
    });
  });

  it("町名が空になる入力には null を返す", () => {
    expect(parseAddressQuery("-1")).toBeNull();
    expect(parseAddressQuery("")).toBeNull();
  });
});

describe("normalizeSearchTerm", () => {
  it("全角・空白・大文字小文字の違いを吸収する", () => {
    expect(normalizeSearchTerm(" ＴＯＨＯ シネマズ ")).toBe("tohoシネマズ");
    expect(normalizeSearchTerm("神田 駅")).toBe("神田駅");
  });
});
