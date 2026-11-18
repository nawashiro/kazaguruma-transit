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
    expect(badge).toHaveClass("whitespace-nowrap");
    expect(badge).not.toHaveClass("badge-outline");
  });

  it("情報なしの値でも無彩色のバッジを出す", () => {
    render(<BarrierBadge wheelchair={null} />);

    expect(badgeFor("情報なし")).toHaveClass("badge-neutral");
  });

  it("未知の値でも情報なしのバッジを出す", () => {
    render(<BarrierBadge wheelchair="bogus" />);

    expect(badgeFor("情報なし")).toHaveClass("badge-neutral");
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
});

describe("BarrierDetailBlock", () => {
  const relatedPages = [
    { name: "東京バリアフリーマップ", url: "https://example.test/barrier-map" },
  ];

  it("車いす情報とバリアフリー情報を別のセクションに分ける", () => {
    render(
      <BarrierDetailBlock
        wheelchair="limited"
        osmElement={{ type: "node", id: 1 }}
        relatedPages={relatedPages}
      />,
    );

    const wheelchairHeading = screen.getByRole("heading", { name: "車いす情報" });
    const barrierHeading = screen.getByRole("heading", { name: "バリアフリー情報" });
    const wheelchairSection = wheelchairHeading.closest("section");
    const barrierSection = barrierHeading.closest("section");
    expect(wheelchairSection).not.toBeNull();
    expect(barrierSection).not.toBeNull();
    if (!(wheelchairSection instanceof HTMLElement) || !(barrierSection instanceof HTMLElement)) {
      throw new Error("expected both sections");
    }

    expect(within(wheelchairSection).getByText("一部")).toBeInTheDocument();
    expect(
      within(wheelchairSection).queryByRole("link", { name: /東京バリアフリーマップ/ }),
    ).toBeNull();
    expect(
      within(barrierSection).getByRole("link", { name: /東京バリアフリーマップ/ }),
    ).toBeInTheDocument();
    expect(barrierSection.querySelector(".badge")).toBeNull();
  });

  it("関連ページがなければバリアフリー情報の見出しを出さない", () => {
    render(
      <BarrierDetailBlock
        wheelchair="yes"
        osmElement={{ type: "node", id: 1 }}
        relatedPages={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "車いす情報" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "バリアフリー情報" }),
    ).not.toBeInTheDocument();
  });

  it("状態バッジと説明文を同じ行に並べ、バッジを折り返さない", () => {
    render(
      <BarrierDetailBlock
        wheelchair="limited"
        osmElement={{ type: "node", id: 1 }}
      />,
    );

    const badge = badgeFor("一部");
    const description = screen.getByText(
      "入口には最大7センチの1段の段差があります。ほとんどの部屋には段がありません。",
    );
    expect(badge.parentElement).toBe(description.parentElement);
    expect(badge.parentElement).toHaveClass(
      "flex",
      "flex-wrap",
      "items-center",
      "gap-2",
    );
    expect(badge).toHaveClass("whitespace-nowrap");
  });

  it("情報なしの説明を追加してくださいに変える", () => {
    render(<BarrierDetailBlock wheelchair={undefined} />);

    expect(badgeFor("情報なし")).toHaveClass("badge-neutral");
    expect(screen.getByText("追加してください。")).toBeInTheDocument();
    expect(
      screen.queryByText("バリアフリー情報がありません。"),
    ).not.toBeInTheDocument();
  });

  it("バッジと参照リンクをルビ対象の外に置き、見出しと説明文にはルビを付ける", () => {
    render(
      <BarrierDetailBlock
        wheelchair="limited"
        osmElement={{ type: "node", id: 1 }}
      />,
    );

    expect(badgeFor("一部").closest(".ruby-text")).toBeNull();
    expect(
      screen
        .getByRole("link", { name: /編集する（WheelMapを開きます）/ })
        .closest(".ruby-text"),
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: "車いす情報" }).closest(".ruby-text"),
    ).not.toBeNull();
    expect(
      screen
        .getByText(
          "入口には最大7センチの1段の段差があります。ほとんどの部屋には段がありません。",
        )
        .closest(".ruby-text"),
    ).not.toBeNull();
  });

  it("状態・説明・参照リンクの後に出典を置く", () => {
    render(
      <BarrierDetailBlock
        wheelchair="limited"
        osmElement={{ type: "node", id: 1 }}
      />,
    );

    const source = screen
      .getByRole("link", { name: /OpenStreetMap contributors/ })
      .closest("p");
    if (!(source instanceof HTMLElement)) {
      throw new Error("expected the source line");
    }
    expect(source).toHaveTextContent(/© OpenStreetMap contributors.*ODbL-1\.0/);
    expect(source.closest(".ruby-text")).toBeNull();

    const description = screen.getByText(
      "入口には最大7センチの1段の段差があります。ほとんどの部屋には段がありません。",
    );
    const link = screen.getByRole("link", {
      name: /編集する（WheelMapを開きます）/,
    });
    expect(
      description.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      link.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("参照リンクをセカンダリボタンにし、上端に寄せない", () => {
    render(
      <BarrierDetailBlock
        wheelchair="limited"
        osmElement={{ type: "node", id: 1 }}
      />,
    );

    const link = screen.getByRole("link", {
      name: /編集する（WheelMapを開きます）/,
    });
    expect(link).toHaveClass(
      "btn",
      "btn-secondary",
      "rounded-full",
      "dark:rounded-sm",
      "min-h-[44px]",
      "h-auto",
      "text-base",
    );
    expect(link).not.toHaveClass("btn-outline", "py-2");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("（新しいタブで開きます）");
  });
});
