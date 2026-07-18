import { render, screen } from "@testing-library/react";
import SidebarLayout from "../SidebarLayout";

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
});
