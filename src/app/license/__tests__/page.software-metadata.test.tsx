import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "@jest/globals";
import LicensePage from "@/app/license/page";

describe("LicensePage software metadata rendering", () => {
  it("hides repository/funding when missing", async () => {
    const ui = await LicensePage();
    render(ui);

    expect(screen.queryByText("Repository")).toBeNull();
    expect(screen.queryByText("Funding")).toBeNull();
  });
});
