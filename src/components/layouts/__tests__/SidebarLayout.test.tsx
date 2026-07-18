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
  it("全ページ共通の本文後にKo-fi支援欄を表示する", () => {
    render(
      <SidebarLayout
        koFiUsername="nawashiro"
        koFiContent={{
          heading: "開発者を支援する",
          message: "支援をお願いします。",
        }}
      >
        <main>ページ本文</main>
      </SidebarLayout>,
    );

    const pageContent = screen.getByText("ページ本文");
    const cookiePolicyLink = screen.getByRole("link", {
      name: "クッキーポリシー",
    });
    const supportFrame = screen.getByTitle("開発者を支援する（Ko-fi）");

    expect(pageContent.compareDocumentPosition(supportFrame)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(cookiePolicyLink.compareDocumentPosition(supportFrame)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
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
        <main>ページ本文</main>
      </SidebarLayout>,
    );

    expect(
      screen.queryByTitle("開発者を支援する（Ko-fi）"),
    ).not.toBeInTheDocument();
  });
});
