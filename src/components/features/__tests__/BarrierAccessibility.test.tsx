import Link from "next/link";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  BarrierBadge,
  BarrierDetailBlock,
} from "@/components/features/BarrierAccessibility";

function badgeFor(label: string): HTMLElement {
  const badge = screen.getByText(label).closest(".badge");
  if (!(badge instanceof HTMLElement)) {
    throw new Error(`expected ${label} to be inside a badge`);
  }
  return badge;
}

describe("BarrierBadge", () => {
  it.each([
    ["yes", "全面", "badge-success"],
    ["limited", "一部", "badge-warning"],
    ["no", "非対応", "badge-error"],
  ] as const)("%s は %s を意味色の塗りバッジで示す", (wheelchair, label, color) => {
    render(<BarrierBadge wheelchair={wheelchair} />);

    const badge = badgeFor(label);
    expect(badge).toHaveClass("badge", "badge-lg", "text-xl", "font-bold", color);
    expect(badge).not.toHaveClass("badge-outline");
  });

  it("アイコンに車いすの代替テキストを添え、状態文言の前に読ませる", () => {
    render(
      <Link href="/locations/location-detail/example">
        <BarrierBadge wheelchair="limited" />
      </Link>,
    );

    const badge = badgeFor("一部");
    expect(screen.getByRole("link")).toHaveAccessibleName("車いす 一部");

    const alternative = within(badge).getByText("車いす");
    const label = within(badge).getByText("一部");
    expect(alternative).toHaveClass("sr-only");
    expect(
      alternative.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(badge.querySelector("svg")).toHaveClass("size-6");
  });

  it("情報なしの値ではバッジを出さない", () => {
    const { container } = render(<BarrierBadge wheelchair={null} />);

    expect(container.querySelector(".badge")).toBeNull();
  });
});

describe("BarrierDetailBlock", () => {
  it("カード状の入れ子と出典の重複を出さない", () => {
    render(
      <BarrierDetailBlock
        wheelchair="limited"
        osmElement={{ type: "node", id: 1 }}
      />,
    );

    const heading = screen.getByRole("heading", { name: "バリアフリー情報" });
    const section = heading.closest("section");
    if (!(section instanceof HTMLElement)) {
      throw new Error("expected the barrier heading inside a section");
    }

    expect(section.querySelector(".card")).toBeNull();
    expect(section.querySelector(".rounded-box")).toBeNull();
    expect(section.querySelector(".border-l-4")).toBeNull();
    expect(section).not.toHaveTextContent("情報源: OpenStreetMap");
    expect(
      within(section).getByText(
        "入口には最大7センチの1段の段差があります。ほとんどの部屋には段がありません。",
      ),
    ).toBeInTheDocument();
  });

  it("状態を意味色のバッジで示し、参照リンクをセカンダリボタンにする", () => {
    render(
      <BarrierDetailBlock
        wheelchair="limited"
        osmElement={{ type: "node", id: 1 }}
      />,
    );

    expect(badgeFor("一部")).toHaveClass("badge-warning");

    const link = screen.getByRole("link", {
      name: /詳細を見る・編集する（WheelMapを開きます）/,
    });
    expect(link).toHaveClass(
      "btn",
      "btn-secondary",
      "rounded-full",
      "dark:rounded-sm",
      "min-h-[44px]",
      "text-base",
    );
    expect(link).not.toHaveClass("btn-outline");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("情報なしも無彩色のバッジで示す", () => {
    render(<BarrierDetailBlock wheelchair={undefined} />);

    expect(badgeFor("情報なし")).toHaveClass("badge-neutral");
  });
});
