import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, jest } from "@jest/globals";

jest.mock("@/lib/license/licensePayload", () => ({
  getLicensePagePayload: jest.fn(async () => ({
    software: {
      name: "kazaguruma-transit",
      version: "1.4.3",
      license: "AGPL-3.0",
      author: "Nawashiro",
      repository: "https://github.com/nawashiro/kazaguruma-transit",
    },
    openData: [
      {
        id: "dataset-1",
        name: "dataset",
        licenseName: "CC BY",
        sourceUrl: "https://example.test/source",
        licenseUrl: "https://example.test/license",
      },
    ],
    dependencies: [
      {
        packageName: "@edge-runtime/cookies",
        version: "5.0.0",
        license: "MIT",
      },
      {
        packageName: "@opentelemetry/api",
        version: "1.9.0",
        license: "Apache-2.0",
      },
    ],
    generatedAt: "2026-02-16T00:00:00.000Z",
  })),
}));

describe("LicensePage responsive layout", () => {
  it("keeps every data table within the card on narrow screens", async () => {
    const { default: LicensePage } = await import("@/app/license/page");
    render(await LicensePage());

    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(3);
    tables.forEach((table) => {
      expect(table.classList.contains("table-fixed")).toBe(true);
      expect(table.classList.contains("w-full")).toBe(true);
      expect(table.classList.contains("text-base")).toBe(true);
      expect(table.classList.contains("table-xs")).toBe(false);
      expect(table.classList.contains("table-sm")).toBe(false);
    });

    const columnHeaders = screen.getAllByRole("columnheader");
    expect(columnHeaders).toHaveLength(5);
    columnHeaders.forEach((header) => {
      expect(header.classList.contains("text-base-content")).toBe(true);
    });

    expect(
      screen.getByRole("link", { name: /github.com\/nawashiro\/kazaguruma-transit/ }).classList.contains("break-all")
    ).toBe(true);
    expect(
      screen.getByRole("rowheader", { name: "@edge-runtime/cookies" }).classList.contains("break-all")
    ).toBe(true);

    const dependenciesTable = screen.getByRole("table", { name: "導入パッケージ" });
    within(dependenciesTable).getAllByText("Apache-2.0").forEach((licenseBadge) => {
      expect(licenseBadge.classList.contains("whitespace-normal")).toBe(true);
    });
  });
});
