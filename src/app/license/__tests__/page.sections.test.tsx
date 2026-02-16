import { render, screen } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";
import LicensePage from "@/app/license/page";

jest.mock("@/lib/license/licensePayload", () => ({
  getLicensePagePayload: jest.fn(async () => ({
    software: { name: "app", version: "1.0.0", license: "MIT", author: "Team" },
    openData: [{ id: "1", name: "dataset", licenseName: "CC BY" }],
    dependencies: [{ packageName: "react", version: "19.1.0", license: "MIT" }],
    generatedAt: "2026-02-16T00:00:00.000Z",
  })),
}));

describe("LicensePage sections", () => {
  it("shows three section headings", async () => {
    const ui = await LicensePage();
    render(ui);

    expect(
      screen.getByRole("heading", { name: "本ソフトウェア", level: 2 })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "オープンデータ", level: 2 })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "導入パッケージ", level: 2 })
    ).toBeTruthy();
  });
});
