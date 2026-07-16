import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "@jest/globals";
import LicensePage from "@/app/license/page";

describe("LicensePage responsive layout", () => {
  it("keeps every data table within the card on narrow screens", async () => {
    render(await LicensePage());

    const tables = screen.getAllByRole("table");
    expect(tables).toHaveLength(3);
    tables.forEach((table) => {
      expect(table.classList.contains("table-fixed")).toBe(true);
      expect(table.classList.contains("w-full")).toBe(true);
      expect(table.classList.contains("text-sm")).toBe(true);
      expect(table.classList.contains("table-xs")).toBe(false);
      expect(table.classList.contains("table-sm")).toBe(false);
    });

    expect(
      screen.getByRole("link", { name: /github.com\/nawashiro\/kazaguruma-transit/ }).classList.contains("break-all")
    ).toBe(true);
    expect(
      screen.getByRole("rowheader", { name: "@googlemaps/google-maps-services-js" }).classList.contains("break-all")
    ).toBe(true);

    const dependenciesTable = screen.getByRole("table", { name: "導入パッケージ" });
    within(dependenciesTable).getAllByText("Apache-2.0").forEach((licenseBadge) => {
      expect(licenseBadge.classList.contains("whitespace-normal")).toBe(true);
    });
  });
});
