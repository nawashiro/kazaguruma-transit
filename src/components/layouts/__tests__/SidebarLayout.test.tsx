import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import type { KeyLocation } from "@/utils/addressLoader";
import SidebarLayout from "../SidebarLayout";

const mockLoadKeyLocationsDataResult = jest.fn();

const locationDetailFixture: KeyLocation = {
  id: "location-detail-host-fixture",
  name: "神田図書館",
  lat: 35.694,
  lng: 139.768,
  area: "神田",
  description: "地域の図書館です",
  descriptionCopyright: "千代田区オープンデータ",
  imageUri: "https://example.test/kanda-library.jpg",
  imageCopyright: "市民写真家",
  uri: "https://example.test/kanda-library",
  nodeCopyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

jest.mock("@/utils/addressLoader", () => {
  const actual = jest.requireActual("@/utils/addressLoader");
  return {
    ...actual,
    loadKeyLocationsDataResult: mockLoadKeyLocationsDataResult,
  };
});

type LocationDetailPage = (props: {
  params: Promise<{ id: string }>;
}) => ReactNode | Promise<ReactNode>;

function getLocationDetailPage(): LocationDetailPage {
  // Load after the loader spy is initialized so the real route observes it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded: unknown = require("@/app/location-detail/[id]/page");
  if (typeof loaded !== "object" || loaded === null) {
    throw new Error("location detail page module did not export an object");
  }

  const page = (loaded as { default?: unknown }).default;
  if (typeof page !== "function") {
    throw new Error("location detail page module did not export a default page");
  }
  return page as LocationDetailPage;
}

jest.mock("next/script", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("../Sidebar", () => ({
  __esModule: true,
  default: () => <nav aria-label="サイドバー" />,
}));
jest.mock("../../ui/ThemeToggle", () => ({
  __esModule: true,
  default: () => <button type="button">テーマ</button>,
}));
jest.mock("../../ui/SkipToContent", () => ({
  __esModule: true,
  default: () => null,
}));

describe("SidebarLayout", () => {
  it("drawerの内部checkboxをTab順から除外し、メニューボタンでdrawerを制御する", () => {
    render(
      <SidebarLayout
        koFiUsername={null}
        koFiContent={{
          heading: "開発者を支援する",
          message: "支援をお願いします。",
        }}
      >
        <div>ページ本文</div>
      </SidebarLayout>,
    );

    const drawerToggle = screen.getByRole("checkbox", {
      name: "ナビゲーションメニュー",
    });
    const menuButton = screen.getByRole("button", { name: "メニュー" });

    expect(drawerToggle).toHaveAttribute("id", "drawer");
    expect(drawerToggle).toHaveAttribute("tabindex", "-1");
    expect((drawerToggle as HTMLInputElement).tabIndex).toBe(-1);
    expect(menuButton.tagName).toBe("BUTTON");
    expect(menuButton).toHaveAttribute("aria-controls", "drawer");
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect((menuButton as HTMLButtonElement).tabIndex).toBeGreaterThanOrEqual(0);
  });

  it("ヘッダーはスマホの左右配置を維持しつつPC幅でテーマ切替を右寄せにする", () => {
    render(
      <SidebarLayout
        koFiUsername={null}
        koFiContent={{
          heading: "開発者を支援する",
          message: "支援をお願いします。",
        }}
      >
        <div>ページ本文</div>
      </SidebarLayout>,
    );

    const themeToggle = screen.getByRole("button", { name: "テーマ" });
    const menuButton = screen.getByRole("button", { name: "メニュー" });
    const header = themeToggle.parentElement;
    expect(header).not.toBeNull();
    expect(menuButton).toHaveClass("lg:hidden");
    expect(menuButton.compareDocumentPosition(themeToggle)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(header).toHaveClass("justify-between", "lg:justify-end");
  });

  it("共通のメインコンテンツ枠内でページ本文後にKo-fi支援欄を表示する", () => {
    render(
      <SidebarLayout
        koFiUsername="nawashiro"
        koFiContent={{
          heading: "開発者を支援する",
          message: "支援をお願いします。",
        }}
      >
        <div>ページ本文</div>
      </SidebarLayout>,
    );

    const pageContent = screen.getByText("ページ本文");
    const cookiePolicyLink = screen.getByRole("link", {
      name: "クッキーポリシー",
    });
    const supportFrame = screen.getByTitle("開発者を支援する（Ko-fi）");
    const mainContent = pageContent.closest("#main-content");
    const footer = cookiePolicyLink.closest("footer");

    expect(mainContent).toContainElement(supportFrame);
    expect(mainContent?.tagName).toBe("MAIN");
    expect(footer).not.toContainElement(supportFrame);
    expect(pageContent.compareDocumentPosition(supportFrame)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(supportFrame.compareDocumentPosition(cookiePolicyLink)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("renders the location detail page through the shared main host and keeps Ko-fi after page content", async () => {
    mockLoadKeyLocationsDataResult.mockResolvedValue({
      status: "success",
      categories: [
        {
          category: "公共施設",
          "category:en": "public-facilities",
          locations: [locationDetailFixture],
        },
      ],
    });

    const page = await getLocationDetailPage()({
      params: Promise.resolve({ id: locationDetailFixture.id }),
    });

    render(
      <SidebarLayout
        koFiUsername="nawashiro"
        koFiContent={{
          heading: "開発者を支援する",
          message: "支援をお願いします。",
        }}
      >
        {page}
      </SidebarLayout>,
    );

    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);

    const mainContent = mains[0];
    const locationHeading = within(mainContent).getByRole("heading", {
      level: 1,
      name: locationDetailFixture.name,
    });
    const providedHeadings = within(mainContent).getAllByRole("heading", {
      level: 2,
      name: "提供",
    });
    const supportFrame = within(mainContent).getByTitle("開発者を支援する（Ko-fi）");
    const cookiePolicyLink = screen.getByRole("link", {
      name: "クッキーポリシー",
    });

    expect(mainContent).toHaveAttribute("id", "main-content");
    expect(mainContent).toHaveAttribute("tabindex", "-1");
    expect(within(mainContent).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(providedHeadings).toHaveLength(1);
    expect(locationHeading.closest("header")).not.toBeNull();

    expect(mainContent).toContainElement(supportFrame);
    expect(locationHeading.compareDocumentPosition(supportFrame)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(cookiePolicyLink.closest("footer")).not.toContainElement(supportFrame);
  });

  it("規約リンクを共通幅の左端に揃えて最下部に表示する", () => {
    render(
      <SidebarLayout
        koFiUsername="nawashiro"
        koFiContent={{
          heading: "開発者を支援する",
          message: "支援をお願いします。",
        }}
      >
        <div>ページ本文</div>
      </SidebarLayout>,
    );

    const termsLink = screen.getByRole("link", { name: "利用規約" });
    const footerLinkContainer = termsLink.parentElement;
    const footer = termsLink.closest("footer");

    expect(footerLinkContainer).toHaveClass("flex-col", "items-start");
    expect(footerLinkContainer).not.toHaveClass("sm:flex-row");
    expect(footer?.parentElement?.lastElementChild).toBe(footer);
    within(footer as HTMLElement)
      .getAllByRole("link")
      .forEach((link) => {
        expect(link).toHaveClass("text-base-content");
        expect(link).not.toHaveClass("text-base-content/60");
      });
  });

  it("FUNDING.ymlにko_fiがなければ支援欄を表示しない", () => {
    render(
      <SidebarLayout
        koFiUsername={null}
        koFiContent={{
          heading: "開発者を支援する",
          message: "支援をお願いします。",
        }}
      >
        <div>ページ本文</div>
      </SidebarLayout>,
    );

    expect(
      screen.queryByTitle("開発者を支援する（Ko-fi）"),
    ).not.toBeInTheDocument();
  });

  it("public layout exposes exactly one keyboard-focusable main-content landmark", () => {
    render(
      <SidebarLayout
        koFiUsername={null}
        koFiContent={{
          heading: "開発者を支援する",
          message: "支援をお願いします。",
        }}
      >
        <div>公開ページ本文</div>
      </SidebarLayout>,
    );

    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute("id", "main-content");
    expect(mains[0]).toHaveAttribute("tabindex", "-1");
    expect((mains[0] as HTMLElement).tabIndex).toBe(-1);
  });
});
