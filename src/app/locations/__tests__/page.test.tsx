import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import generatedLocationData from "@/generated/location-data.json";
import LocationsPage from "../page";
import type { KeyLocationCategory } from "../../../utils/addressLoader";

jest.mock("../../../lib/location/location-list-state", () => ({
  ...jest.requireActual("../../../lib/location/location-list-state"),
  loadLocationCategories: jest.fn(),
  groupCategoryLocationsByArea: jest.fn(),
}));

const locationListStateMock = jest.requireMock(
  "../../../lib/location/location-list-state",
) as {
  loadLocationCategories: jest.Mock;
  groupCategoryLocationsByArea: jest.Mock;
};
const mockLoadLocationCategories = locationListStateMock.loadLocationCategories;
const mockGroupCategoryLocationsByArea =
  locationListStateMock.groupCategoryLocationsByArea;
const mockFetch = global.fetch as jest.Mock;

describe("LocationsPage", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockLoadLocationCategories.mockReset();
    mockGroupCategoryLocationsByArea.mockReset();
  });

  it("生成済みスナップショットを静的に表示し、旧来の検索・タブ操作を持たない", () => {
    render(<LocationsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "場所をさがす" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "カテゴリを選択" })).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(mockLoadLocationCategories).not.toHaveBeenCalled();
    expect(mockGroupCategoryLocationsByArea).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("既存の案内とデータ提供元を表示する", () => {
    render(<LocationsPage />);

    expect(screen.getByText(/お悩みハンドブックウェブサイトへ/)).toBeInTheDocument();
    expect(screen.getByText(/せかいビバークウェブサイトへ/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "データ提供元" })).toBeInTheDocument();
    expect(screen.getByText(/千代田区主要施設座標データ/)).toBeInTheDocument();
  });

  it("公開済みの詳細カテゴリをすべて通常のURLリンクとして公開する", async () => {
    const allCategoryFixtures: KeyLocationCategory[] = generatedLocationData.categories.map(
      (category) => ({
        category: category.name,
        "category:en": category.id,
        locations: category.locations.map((location) => ({ ...location })),
      }),
    );
    mockLoadLocationCategories.mockResolvedValueOnce(allCategoryFixtures);

    render(<LocationsPage />);

    const expectedHrefs = generatedLocationData.categories.map(
      (category) => `/locations/${encodeURIComponent(category.id)}`,
    );
    await waitFor(() => {
      const categoryLinks = screen.queryAllByRole("link").filter((link) => {
        const href = link.getAttribute("href") ?? "";
        return href.startsWith("/locations/") && !href.startsWith("/locations/location-detail/");
      });
      expect(categoryLinks).toHaveLength(expectedHrefs.length);
    });

    const categoryLinks = screen.queryAllByRole("link").filter((link) => {
      const href = link.getAttribute("href") ?? "";
      return href.startsWith("/locations/") && !href.startsWith("/locations/location-detail/");
    });
    expect(categoryLinks.every((link) => link.tagName === "A")).toBe(true);
    expect(new Set(categoryLinks.map((link) => link.getAttribute("href")))).toEqual(
      new Set(expectedHrefs),
    );
    for (const category of generatedLocationData.categories) {
      const categoryLink = categoryLinks.find(
        (link) =>
          link.getAttribute("href") ===
          `/locations/${encodeURIComponent(category.id)}`,
      );
      expect(categoryLink).toBeDefined();
      if (categoryLink) {
        expect(categoryLink).toHaveTextContent(category.name);
      }
    }

    const categoryNames = new Set(
      generatedLocationData.categories.map((category) => category.name),
    );
    const categoryTabs = screen.queryAllByRole("tab").filter((tab) =>
      categoryNames.has(tab.textContent?.trim() ?? ""),
    );
    expect(categoryTabs).toHaveLength(0);
  });

  it("does not retain the retired root detail URL in location production links", () => {
    const productionPaths = [
      path.resolve(__dirname, "../page.tsx"),
      path.resolve(__dirname, "../[category-id]/page.tsx"),
      path.resolve(__dirname, "../location-detail/[id]/page.tsx"),
      path.resolve(__dirname, "../../location-detail/[id]/page.tsx"),
      path.resolve(__dirname, "../../../components/features/LocationCard.tsx"),
    ].filter((sourcePath) => existsSync(sourcePath));
    const retiredRootDetailHrefPrefixes = [
      String.fromCharCode(34) + "/location-detail/",
      String.fromCharCode(39) + "/location-detail/",
      String.fromCharCode(96) + "/location-detail/",
    ];

    expect(productionPaths.length).toBeGreaterThan(0);
    for (const sourcePath of productionPaths) {
      const source = readFileSync(sourcePath, "utf8");
      expect(
        retiredRootDetailHrefPrefixes.some((prefix) => source.includes(prefix)),
      ).toBe(false);
    }
  });
});
