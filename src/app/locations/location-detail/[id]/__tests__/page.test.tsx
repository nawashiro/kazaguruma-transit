import path from "node:path";
import { existsSync } from "node:fs";
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import generatedLocationData from "@/generated/location-data.json";

type GeneratedLocation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
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
};

type PublicModule = Record<string, unknown>;
type ModuleState = {
  exports: PublicModule | null;
  error: unknown | null;
};
type DetailPage = (props: {
  params: Promise<{ id: string }>;
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
        error: new Error("location detail page module did not export an object"),
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
    throw new Error(`location detail page is not implemented: ${detail}`);
  }
  if (!state.exports) {
    throw new Error("location detail page is not implemented: public module exported nothing");
  }
  return state.exports;
}

function getPage(): DetailPage {
  const page = getPageModule().default;
  expect(typeof page).toBe("function");
  if (typeof page !== "function") {
    return () => null;
  }
  return page as DetailPage;
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

function readLocationIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string") {
      return [];
    }
    return [item.id];
  });
}

function findCategory(id: string): GeneratedCategory {
  const category = snapshot.categories.find((candidate) => candidate.id === id);
  if (!category) {
    throw new Error(`generated category fixture is missing: ${id}`);
  }
  return category;
}

async function renderDetailPage(id: string): Promise<void> {
  const page = getPage();
  const element = await page({ params: Promise.resolve({ id }) });
  expect(React.isValidElement(element)).toBe(true);
  if (!React.isValidElement(element)) {
    return;
  }
  render(<main id="main-content">{element}</main>);
}

const detailCategory = findCategory("city_office_and_branch_offices");
const detailLocation = detailCategory.locations.find(
  (location) => location.id === "5e3b1528-8af6-436a-83af-24ca45b58e12",
);
if (!detailLocation) {
  throw new Error("generated detail location fixture is missing");
}

if (!routeModuleExists) {
  describe("/locations/location-detail/[id] missing public route", () => {
    it("reports the missing detail page as an explicit RED", () => {
      const state = loadPageModule();

      // This assertion is intentionally RED until the public route exists.
      expect(state.error).toBeNull();
    });
  });
} else {
  describe("/locations/location-detail/[id] public route", () => {
    const originalFetch = global.fetch;
    const mockFetch = jest.fn();

    beforeEach(() => {
      mockFetch.mockReset();
      global.fetch = mockFetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("disallows unknown detail params while retaining static params", () => {
      const pageModule = getPageModule();

      expect(pageModule.dynamicParams).toBe(false);
      expect(typeof pageModule.generateStaticParams).toBe("function");
    });

    it("enumerates every generated facility for static generation", async () => {
      const params = await getGenerateStaticParams()();
      const actualIds = readLocationIds(params);
      const expectedIds = snapshot.categories.flatMap((category) =>
        category.locations.map((location) => location.id),
      );

      expect(actualIds).toHaveLength(expectedIds.length);
      expect(new Set(actualIds)).toEqual(new Set(expectedIds));
    });

    it("renders facility metadata, attribution, and the exact category return link without runtime fetch", async () => {
      await renderDetailPage(detailLocation.id);

      const headingNames = screen
        .queryAllByRole("heading", { level: 1 })
        .map((heading) => heading.textContent?.trim());
      expect(headingNames).toContain(detailLocation.name);
      expect(
        screen.queryAllByText(detailLocation.areaName, { exact: true }),
      ).not.toHaveLength(0);
      expect(
        screen.queryAllByText(detailLocation.description ?? "", { exact: true }),
      ).not.toHaveLength(0);

      const images = Array.from(document.querySelectorAll("img"));
      expect(
        images.some((image) => image.getAttribute("src") === detailLocation.imageUri),
      ).toBe(true);
      expect(
        screen
          .queryAllByRole("link")
          .some((link) => link.getAttribute("href") === detailLocation.uri),
      ).toBe(true);

      expect(
        screen.queryAllByText("座標データ提供", { selector: "dt" }),
      ).not.toHaveLength(0);
      expect(
        screen.queryAllByText(detailLocation.nodeCopyright, { exact: true }),
      ).not.toHaveLength(0);
      expect(screen.queryAllByText("ライセンス", { selector: "dt" })).not.toHaveLength(0);
      expect(
        screen
          .queryAllByRole("link")
          .some((link) => link.getAttribute("href") === detailLocation.licenceUri),
      ).toBe(true);

      const returnLink = screen
        .queryAllByRole("link")
        .find(
          (link) =>
            link.textContent?.trim() === `${detailCategory.name}カテゴリに戻る`,
        );
      expect(returnLink).toBeDefined();
      if (returnLink) {
        expect(returnLink).toHaveAttribute(
          "href",
          `/locations/${encodeURIComponent(detailCategory.id)}`,
        );
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("builds the facility destination CTA from a coordinate-only query", async () => {
      await renderDetailPage(detailLocation.id);

      const destinationLink = screen.getByRole("link", { name: "ここへ行く" });
      const href = destinationLink.getAttribute("href");
      if (href === null) {
        throw new Error("facility destination CTA is missing href");
      }

      const searchParams = new URL(href, "https://example.test").searchParams;
      expect(searchParams.get("destination")).toBe(
        `${detailLocation.lat},${detailLocation.lng}`,
      );
      expect(Array.from(searchParams.keys())).toEqual(["destination"]);
      expect(searchParams.get("destination")).not.toMatch(/[{}]/);
      expect(searchParams.get("destination")).not.toContain("address");
    });
  });
}
