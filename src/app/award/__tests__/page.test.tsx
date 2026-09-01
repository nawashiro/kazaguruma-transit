import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AwardPage from "../page";

describe("AwardPage", () => {
  it("受賞内容と公式な確認先を表示する", () => {
    render(<AwardPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "受賞について" }),
    ).toBeInTheDocument();
    expect(screen.getByText("行政課題解決賞")).toBeInTheDocument();
    expect(screen.getByText("サービス開発部門 ファイナリスト")).toBeInTheDocument();
    expect(screen.getByText("2025年10月25日")).toBeInTheDocument();
    expect(
      screen.getByText("東京都デジタルサービス局（都知事杯オープンデータ・ハッカソン運営事務局）"),
    ).toBeInTheDocument();

    const projectLink = screen.getByRole("link", { name: /東京都の作品紹介を見る/ });
    expect(projectLink).toHaveClass("ruby-text", "gap-0");
    expect(projectLink.querySelector("span")).toBeNull();
    expect(projectLink).toHaveAttribute(
      "href",
      "https://odhackathon.metro.tokyo.lg.jp/collection/54/?year=2025",
    );

    const badgeLink = screen.getByRole("link", { name: "オープンバッジを確認する" });
    expect(badgeLink).toHaveClass("ruby-text", "gap-0");
    expect(badgeLink.querySelector("span")).toBeNull();
    expect(badgeLink).toHaveAttribute(
      "href",
      "https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/RWRseGxrR0NmM0Q5QnAwdTdjeHFHdz09",
    );
  });

  it("見出しを直接ルビ対象にし、低コントラストなテーマ色を使わない", () => {
    const { container } = render(<AwardPage />);

    for (const heading of screen.getAllByRole("heading", { level: 2 })) {
      expect(heading).toHaveClass("ruby-text", "gap-0");
      expect(heading.querySelector(":scope > span")).toBeNull();
    }

    expect(container.querySelector(".text-primary")).not.toBeInTheDocument();
    expect(container.querySelector(".badge-warning")).not.toBeInTheDocument();
    expect(container.querySelector(".badge-soft")).not.toBeInTheDocument();
    expect(container.querySelector(".btn-primary")).not.toBeInTheDocument();
  });

  it("見出しと重複する受賞バッジを表示しない", () => {
    const { container } = render(<AwardPage />);

    expect(screen.queryByText("受賞")).not.toBeInTheDocument();
    expect(container.querySelector(".badge")).not.toBeInTheDocument();
  });
});
