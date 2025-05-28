import { render, screen } from "@testing-library/react";
import SiteMapPage from "../site-map/page";

describe("SiteMapPage", () => {
  it("メインタイトルが表示されること", () => {
    render(<SiteMapPage />);
    expect(
      screen.getByRole("heading", { name: "サイトマップ", level: 1 })
    ).toBeInTheDocument();
  });

  it("各セクションが適切な見出しで表示されること", () => {
    render(<SiteMapPage />);
    expect(
      screen.getByRole("heading", { name: "メインコンテンツ", level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "使い方情報", level: 2 })
    ).toBeInTheDocument();
  });

  it("すべてのページへのリンクが含まれていること", () => {
    render(<SiteMapPage />);
    expect(screen.getByRole("link", { name: "ホーム" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "場所をさがす" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "はじめての方へ" })
    ).toBeInTheDocument();
  });

  it("外部リンクには適切な属性が設定されていること", () => {
    render(<SiteMapPage />);

    // 外部リンクには適切な属性が設定されていることを確認
    const updatesLink = screen.getByRole("link", { name: "更新情報" });
    expect(updatesLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(updatesLink).toHaveAttribute("target", "_blank");
  });
});
