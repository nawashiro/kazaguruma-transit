import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ReactElement } from "react";

type RateLimitPageProps = {
  searchParams: Promise<{ source?: string | string[] | undefined }>;
};

type RateLimitPageModule = {
  default: (props: RateLimitPageProps) => ReactElement | Promise<ReactElement>;
  metadata: { title: string };
};

const publicPageModulePath = ["..", "page"].join("/");

function isMissingPublicPageModule(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return false;
  }
  return /Cannot find module ['"]\.\.\/page['"]/.test(String(error.message));
}

async function loadPublicRateLimitPage(): Promise<RateLimitPageModule> {
  try {
    const pageModule = (await import(publicPageModulePath)) as Partial<RateLimitPageModule>;
    if (typeof pageModule.default !== "function") {
      throw new Error("T032 RED: /rate-limit must expose a public default page component");
    }
    return pageModule as RateLimitPageModule;
  } catch (error) {
    if (isMissingPublicPageModule(error)) {
      throw new Error(
        "T032 RED: public /rate-limit page module is missing; implement src/app/rate-limit/page.tsx",
        { cause: error },
      );
    }
    throw error;
  }
}

async function renderPublicRateLimitPage(
  pageModule: RateLimitPageModule,
  source?: string,
) {
  const element = await pageModule.default({
    searchParams: Promise.resolve(source === undefined ? {} : { source }),
  });
  const view = render(element);

  // Keep the assertion representative for a page that delegates main to its host.
  if (view.container.querySelectorAll("main").length === 0) {
    view.unmount();
    return render(<main id="main-content">{element}</main>);
  }

  return view;
}

describe("/rate-limit public page contract (T032)", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it.each([
    ["home", "/"],
    ["locations", "/locations"],
    ["routes", "/"],
    [undefined, "/locations"],
    ["invalid-source", "/locations"],
  ])("renders the public page for source=%s with return path %s", async (source, expectedPath) => {
    const pageModule = await loadPublicRateLimitPage();
    await renderPublicRateLimitPage(pageModule, source);

    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "リクエスト制限に達しました",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1時間.*60/)).toBeInTheDocument();
    expect(screen.getByText(/1時間待/)).toBeInTheDocument();
    expect(screen.getByText(/ブラウザを閉じても/)).toBeInTheDocument();

    const returnLink = screen.getByRole("link");
    expect(returnLink).toHaveAccessibleName();
    expect(returnLink).toHaveClass("link");
    expect(returnLink).not.toHaveClass("btn");
    expect(returnLink).not.toHaveClass("btn-primary");
    expect(returnLink.getAttribute("href")).toBeTruthy();
    expect(returnLink).toHaveAttribute("href", expectedPath);
  });

  it("asserts exported metadata and performs no fetch during render or reload", async () => {
    const pageModule = await loadPublicRateLimitPage();
    expect(pageModule.metadata.title).toEqual(expect.stringContaining("リクエスト制限"));

    const first = await renderPublicRateLimitPage(pageModule, "home");
    expect(global.fetch).not.toHaveBeenCalled();

    const reloadedElement = await pageModule.default({
      searchParams: Promise.resolve({ source: "home" }),
    });
    first.rerender(reloadedElement);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });
});
