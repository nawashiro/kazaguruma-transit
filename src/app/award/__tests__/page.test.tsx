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

    expect(screen.getByRole("link", { name: /東京都の作品紹介を見る/ })).toHaveAttribute(
      "href",
      "https://odhackathon.metro.tokyo.lg.jp/collection/54/?year=2025",
    );
    expect(
      screen.getByRole("link", { name: "オープンバッジを確認する" }),
    ).toHaveAttribute(
      "href",
      "https://www.openbadge-global.com/ns/portal/openbadge/public/assertions/detail/RWRseGxrR0NmM0Q5QnAwdTdjeHFHdz09",
    );
  });
});
