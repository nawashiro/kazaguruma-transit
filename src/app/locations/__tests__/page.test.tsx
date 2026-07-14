import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationsPage from "../page";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("../../../utils/addressLoader", () => ({
  loadKeyLocationsData: jest.fn().mockResolvedValue([
    {
      category: "病院",
      locations: [],
    },
    {
      category: "公共施設",
      locations: [],
    },
  ]),
  convertToLocation: jest.fn(),
}));

jest.mock("../../../utils/clientGeoUtils", () => ({
  loadGeoJSON: jest.fn().mockResolvedValue({ type: "FeatureCollection", features: [] }),
  groupLocationsByArea: jest.fn().mockReturnValue({}),
  formatAreaName: jest.fn(),
  getAreaNameFromCoordinates: jest.fn(),
}));

describe("LocationsPage", () => {
  it("カテゴリデータの読み込み後に最初のタブを選択する", async () => {
    render(<LocationsPage />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "病院" })).toHaveClass(
        "tab-active"
      );
    });

    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "locations-category-病院"
    );
  });

  it("住所検索のjoinが左右の角丸とボタンの結合状態を持つ", async () => {
    render(<LocationsPage />);

    const input = await screen.findByLabelText("住所");
    const submit = screen.getByRole("button", { name: "検索" });

    expect(input).toHaveClass("!rounded-l-full");
    expect(submit).toHaveClass("!rounded-r-full");
    expect(submit).not.toHaveClass("rounded-full");
  });
});
