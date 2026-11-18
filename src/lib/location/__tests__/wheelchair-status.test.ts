import { getWheelchairStatus } from "../wheelchair-status";

describe("getWheelchairStatus", () => {
  it("maps yes to 全面 with WheelMap node URL", () => {
    const status = getWheelchairStatus("yes", { type: "node", id: 1420770185 });
    expect(status).toMatchObject({
      state: "全面",
      label: "全面",
      description: "入口には段がなく、全部の部屋に段がありません。",
      isKnown: true,
      referenceUrl: "https://wheelmap.org/nodes/1420770185",
      linkLabelMain: "編集する",
      linkLabelSub: "（WheelMapを開きます）",
    });
  });

  it("maps limited to 一部 with negative way URL", () => {
    const status = getWheelchairStatus("limited", { type: "way", id: 145408909 });
    expect(status).toMatchObject({
      state: "一部",
      referenceUrl: "https://wheelmap.org/nodes/-145408909",
      linkLabelSub: "（WheelMapを開きます）",
    });
    expect(status.description).toMatch(/7センチ/);
  });

  it("maps no to 非対応", () => {
    const status = getWheelchairStatus("no", { type: "node", id: 1 });
    expect(status.state).toBe("非対応");
    expect(status.description).toMatch(/車いす不可/);
  });

  it("maps missing to 情報なし with add link", () => {
    const status = getWheelchairStatus(null, { type: "node", id: 1 });
    expect(status).toMatchObject({
      state: "情報なし",
      isKnown: false,
      description: "追加してください。",
      linkLabelMain: "追加する",
    });
  });

  it("maps unknown value to 情報なし", () => {
    const status = getWheelchairStatus("bogus", { type: "node", id: 1 });
    expect(status.state).toBe("情報なし");
    expect(status.description).toBe("追加してください。");
  });

  it("uses OpenStreetMap URL and label for relation", () => {
    const status = getWheelchairStatus("yes", { type: "relation", id: 5415394 });
    expect(status.referenceUrl).toBe(
      "https://www.openstreetmap.org/relation/5415394",
    );
    expect(status.linkLabelSub).toBe("（OpenStreetMapを開きます）");
    expect(status.linkLabelMain).toBe("編集する");
  });

  it("uses OpenStreetMap label for relation even when unknown", () => {
    const status = getWheelchairStatus(null, { type: "relation", id: 5415394 });
    expect(status.linkLabelSub).toBe("（OpenStreetMapを開きます）");
  });
});
