import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "@jest/globals";
import LicensePage from "@/app/license/page";

describe("LicensePage regression", () => {
  it("keeps section rendering stable", async () => {
    const ui = await LicensePage();
    render(ui);

    expect(
      screen.getByRole("heading", { name: "ライセンス", level: 1 })
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(3);
  });
});
