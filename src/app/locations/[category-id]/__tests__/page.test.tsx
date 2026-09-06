import path from "node:path";
import { existsSync } from "node:fs";
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import generatedLocationData from "@/generated/location-data.json";

type GeneratedLocation = {
  id: string;
  name: string;
  areaName: string;
  description?: string | null;
  imageUri?: string | null;
  uri?: string | null;
  nodeCopyright: string;
  licence: string;
  licenceUri: string;
};

type GeneratedCategory = {
  id: string;
  name: string;
  locations: GeneratedLocation[];
};

type GeneratedSnapshot = {
  categories: GeneratedCategory[];
  [key: string]: unknown;
};

// Keep the empty-category contract executable without depending on today's
// production snapshot having an empty category.
jest.mock("@/generated/location-data.json", () => {
  const actual = jest.requireActual("@/generated/location-data.json") as GeneratedSnapshot;
  return {
    __esModule: true,
    default: {
      ...actual,
      categories: [
        ...actual.categories,
        { id: "empty-category", name: "空カテゴリ", locations: [] },
      ],
    },
  };
});

type PublicModule = Record<string, unknown>;
type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};
type CategoryPage = (props: {
  params: Promise<{ "category-id": string }>;
}) => React.ReactNode | Promise<React.ReactNode>;
type StaticParamsGenerator = () => unknown | Promise<unknown>;

const routeModulePath = path.resolve(__dirname, "../page");
const routeModuleExists = existsSync(`${routeModulePath}.tsx`);
const snapshot = generatedLocationData as unknown as GeneratedSnapshot;

function loadPageModule(): ModuleState {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded RED boundary
    const loaded: unknown = require(routeModulePath);
    if (typeof loaded !== "object" || loaded === null) {
      return {
        exports: null,
        error: new Error("category page module did not export an object"),
      };
    }
    return { exports: loaded as PublicModule, error: null };
  } catch (error) {
    return { exports: null, error };
  }
}

function getPageModule(): PublicModule {
  const state = loadPageModule();
  if (state.error) {
    const detail = state.error instanceof Error ? state.error.message : String(state.error);
    throw new Error(`category page is not implemented: ${detail}`);
  }
  if (!state.exports) {
    throw new Error("category page is not implemented: public module exported nothing");
  }
  return state.exports;
}

function getPage(): CategoryPage {
  const page = getPageModule().default;
  expect(typeof page).toBe("function");
  if (typeof page !== "function") {
    return () => null;
  }
  return page as CategoryPage;
}

function getGenerateStaticParams(): StaticParamsGenerator {
  const generateStaticParams = getPageModule().generateStaticParams;
  expect(typeof generateStaticParams).toBe("function");
  if (typeof generateStaticParams !== "function") {
    return () => [];
  }
  return generateStaticParams as StaticParamsGenerator;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readCategoryIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item["category-id"] !== "string") {
      return [];
    }
    return [item["category-id"]];
  });
}

function findCategory(id: string): GeneratedCategory {
  const category = snapshot.categories.find((candidate) => candidate.id === id);
  if (!category) {
    throw new Error(`generated category fixture is missing: ${id}`);
  }
  return category;
}

async function renderCategoryPage(categoryId: string): Promise<void> {
  const page = getPage();
  const element = await page({
    params: Promise.resolve({ "category-id": categoryId }),
  });
  expect(React.isValidElement(element)).toBe(true);
  if (!React.isValidElement(element)) {
    return;
  }
  render(<main id="main-content">{element}</main>);
}

if (!routeModuleExists) {
  describe("/locations/[category-id] missing public route", () => {
    it("reports the missing category page as an explicit RED", () => {
      const state = loadPageModule();

      // This assertion is intentionally RED until the public route exists.
      expect(state.error).toBeNull();
    });
  });
} else {
  describe("/locations/[category-id] public route", () => {
    const originalFetch = global.fetch;
    const mockFetch = jest.fn();

    beforeEach(() => {
      mockFetch.mockReset();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("disallows unknown category params while retaining static params", () => {
      const pageModule = getPageModule();

      expect(pageModule.dynamicParams).toBe(false);
      expect(typeof pageModule.generateStaticParams).toBe("function");
    });

    it("enumerates every generated detailed category for static generation", async () => {
      const params = await getGenerateStaticParams()();
      const actualIds = readCategoryIds(params);
      const expectedIds = snapshot.categories.map((category) => category.id);

      expect(actualIds).toHaveLength(expectedIds.length);
      expect(new Set(actualIds)).toEqual(new Set(expectedIds));
    });

    it("renders the requested category's precomputed areas and ordinary detail links without runtime fetch", async () => {
      const category = findCategory("city_office_and_branch_offices");

      await renderCategoryPage(category.id);

      const headingNames = screen
        .queryAllByRole("heading", { level: 1 })
        .map((heading) => heading.textContent?.trim());
      expect(headingNames).toContain(category.name);

      const areaHeadingNames = screen
        .queryAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent?.trim());
      const expectedAreaNames = new Set(
        category.locations.map((location) => location.areaName),
      );
      for (const areaName of expectedAreaNames) {
        expect(areaHeadingNames).toContain(areaName);
      }

      const detailLinks = screen.queryAllByRole("link").filter((link) =>
        (link.getAttribute("href") ?? "").startsWith("/locations/location-detail/"),
      );
      const expectedHrefs = category.locations.map(
        (location) =>
          `/locations/location-detail/${encodeURIComponent(location.id)}`,
      );

      expect(detailLinks).toHaveLength(category.locations.length);
      expect(detailLinks.every((link) => link.tagName === "A")).toBe(true);
      expect(new Set(detailLinks.map((link) => link.getAttribute("href")))).toEqual(
        new Set(expectedHrefs),
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("renders an encoded category id as the real category with detail links", async () => {
      const page = getPage();
      const element = await page({
        params: Promise.resolve({
          "category-id": encodeURIComponent("natural environment park"),
        }),
      });

      expect(React.isValidElement(element)).toBe(true);
      if (!React.isValidElement(element)) {
        return;
      }

      render(<main id="main-content">{element}</main>);

      expect(
        screen.getByRole("heading", { level: 1, name: "自然環境公園" }),
      ).toBeInTheDocument();
      const detailLinks = screen.queryAllByRole("link").filter((link) =>
        (link.getAttribute("href") ?? "").startsWith("/locations/location-detail/"),
      );
      expect(detailLinks.length).toBeGreaterThan(0);
    });

    it("renders a double-encoded category id as the real category with detail links", async () => {
      const page = getPage();
      const element = await page({
        params: Promise.resolve({
          "category-id": encodeURIComponent(
            encodeURIComponent("natural environment park"),
          ),
        }),
      });

      expect(React.isValidElement(element)).toBe(true);
      if (!React.isValidElement(element)) {
        return;
      }

      render(<main id="main-content">{element}</main>);

      expect(
        screen.getByRole("heading", { level: 1, name: "自然環境公園" }),
      ).toBeInTheDocument();
      const detailLinks = screen.queryAllByRole("link").filter((link) =>
        (link.getAttribute("href") ?? "").startsWith("/locations/location-detail/"),
      );
      expect(detailLinks.length).toBeGreaterThan(0);
    });

    it("keeps an empty generated category visible", async () => {
      await renderCategoryPage("empty-category");

      expect(
        screen.queryAllByText("該当する施設はありません", { exact: true }),
      ).not.toHaveLength(0);
    });
  });
}
