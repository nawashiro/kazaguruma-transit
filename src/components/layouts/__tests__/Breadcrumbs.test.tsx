import { render, screen } from "@testing-library/react";
import Breadcrumbs, { type BreadcrumbItem } from "../Breadcrumbs";

describe("Breadcrumbs", () => {
  const items: BreadcrumbItem[] = [
    { label: "場所一覧", href: "/locations" },
    { label: "公園", href: "/locations/%E5%85%AC%E5%9C%92" },
    { label: "千代田公園" },
  ];

  it("パンくずリストをnav要素で示し、親階層をリンクで列挙する", () => {
    render(<Breadcrumbs items={items} />);

    const nav = screen.getByRole("navigation", { name: "パンくずリスト" });
    expect(nav).toHaveClass("breadcrumbs", "text-base");
    expect(screen.getByRole("link", { name: "場所一覧" })).toHaveAttribute(
      "href",
      "/locations",
    );
    expect(
      screen.getByRole("link", { name: "公園" }),
    ).toHaveAttribute("href", "/locations/%E5%85%AC%E5%9C%92");
  });

  it("最終段を現在位置として示し、リンクにしない", () => {
    render(<Breadcrumbs items={items} />);

    const current = screen.getByText("千代田公園");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.closest("a")).toBeNull();
    expect(screen.queryByRole("link", { name: "千代田公園" })).not.toBeInTheDocument();
  });

  it("単一段のパンくずでも現在位置を示す", () => {
    render(<Breadcrumbs items={[{ label: "経路検索結果" }]} />);

    expect(screen.getByText("経路検索結果")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("navigation", { name: "パンくずリスト" }).querySelectorAll("li")).toHaveLength(1);
  });
});
