import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";
import Button, { ButtonLabel } from "../Button";

function replaceRubyTargets(container: HTMLElement) {
  // Rubyful v2 (t=20250507022654) replaces innerHTML and names ruby nodes with readings.
  container.querySelectorAll(".ruby-text").forEach((target) => {
    const text = target.textContent;
    target.innerHTML = `<ruby aria-label="よみ" role="text">${text}<rt class="rubyful-rt" aria-hidden="true">よみ</rt></ruby>`;
  });
}

describe("Button", () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ボタンが正しくレンダリングされ、クリックイベントが発火すること", () => {
    render(
      <Button onClick={mockOnClick} testId="test-button">
        テストボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("transit-button");
    expect(button).toHaveTextContent("テストボタン");

    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("無効状態が適切に表示されること", () => {
    render(
      <Button onClick={mockOnClick} disabled testId="test-button">
        テストボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toBeDisabled();

    // 無効状態ではクリックイベントが発火しないことを確認
    fireEvent.click(button);
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it("ローディング状態が適切に表示されること", () => {
    render(
      <Button onClick={mockOnClick} loading testId="test-button">
        ボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toBeDisabled();

    // ローディング状態のアクセシビリティ
    expect(button).toHaveAttribute("aria-busy", "true");

    // 色コントラストを損なうopacityに依存せず、操作不能状態を示す
    expect(button).not.toHaveClass("opacity-70");
    expect(button).toHaveClass("cursor-not-allowed");
  });

  it("フルワイドスタイルが適用されること", () => {
    render(
      <Button onClick={mockOnClick} fullWidth testId="test-button">
        フルワイドボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toHaveClass("w-full");
  });

  it("カスタムクラス名が適用されること", () => {
    render(
      <Button
        onClick={mockOnClick}
        className="test-custom-class"
        testId="test-button"
      >
        カスタムボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toHaveClass("test-custom-class");
  });

  it("結合ボタンでは丸い角を付けないこと", () => {
    render(
      <Button
        onClick={mockOnClick}
        className="join-item"
        joined
        testId="test-button"
      >
        追加
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).not.toHaveClass("rounded-full");
    expect(button).toHaveClass("join-item");
  });

  it("タイプ属性が正しく設定されること", () => {
    render(
      <Button onClick={mockOnClick} type="submit" testId="test-button">
        送信ボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toHaveAttribute("type", "submit");
  });

  it("アクセシビリティのためのタッチターゲットサイズが確保されていること", () => {
    render(
      <Button onClick={mockOnClick} testId="test-button">
        ボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toHaveClass("min-h-[44px]");
    expect(button).toHaveClass("min-w-[44px]");
  });

  it("操作とアイコンをルビ置換の外に保つこと", () => {
    render(
      <Button testId="test-button">
        内容
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toHaveClass(
      "inline-flex",
      "items-center",
      "justify-center",
      "gap-0",
    );
    expect(button).not.toHaveClass("ruby-text");
    expect(button.querySelector("span.ruby-text")).toHaveTextContent("内容");
  });

  it("ルビ置換後もアイコン、可変ラベル、無効状態とクリックを更新できること", () => {
    const view = render(
      <Button onClick={mockOnClick}>
        <svg aria-hidden="true" data-testid="icon" className="visible" />
        確認
      </Button>
    );
    // Rubyful v2 (t=20250507022654) replaces each target's innerHTML.
    view.container.querySelectorAll(".ruby-text").forEach((target) => {
      target.innerHTML = target.innerHTML.replace("確認", '<ruby aria-label="かくにん" role="text">確認<rt class="rubyful-rt" aria-hidden="true">かくにん</rt></ruby>');
    });
    fireEvent.click(screen.getByRole("button", { name: "確認" }));
    expect(mockOnClick).toHaveBeenCalledTimes(1);

    view.rerender(
      <Button onClick={mockOnClick} loading>
        <svg aria-hidden="true" data-testid="icon" className="hidden" />
        処理中
      </Button>
    );
    expect(screen.getByTestId("icon")).toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "処理中" })).toBeDisabled();
    view.rerender(<Button onClick={mockOnClick}>完了</Button>);
    fireEvent.click(screen.getByRole("button", { name: "完了" }));
    expect(mockOnClick).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it("入れ子とfragmentの全文をルビ変換し、名前を一部で上書きしないこと", () => {
    const view = render(
      <Button>削除 <strong><><span>施設名</span>{0}</></strong></Button>
    );
    const button = screen.getByRole("button", { name: "削除 施設名 0" });
    expect(button).not.toHaveAttribute("aria-label");
    expect([...button.querySelectorAll(".ruby-text")].map((node) => node.textContent))
      .toEqual(["削除 ", "施設名", "0"]);
    replaceRubyTargets(view.container);
    expect(button).toHaveAccessibleName("削除 施設名 0");
    expect(button.querySelector("strong span.ruby-text ruby")).toBeInTheDocument();
    view.unmount();
  });

  it("独自コンポーネントを解析せず、明示したラベル境界だけを変換すること", () => {
    function Facility({ name }: { name: string }) {
      return <strong><ButtonLabel>{name}</ButtonLabel></strong>;
    }
    function PlainLabel() {
      return <span>詳細</span>;
    }
    const view = render(<Button>削除 <Facility name="施設名" /><PlainLabel /></Button>);
    const button = screen.getByRole("button", { name: "削除 施設名 詳細" });
    expect(button).not.toHaveAttribute("aria-label");
    expect(button.querySelectorAll(".ruby-text")).toHaveLength(2);
    replaceRubyTargets(view.container);
    expect(button).toHaveAccessibleName("削除 施設名 詳細");
    view.rerender(<Button>削除 <Facility name="別の施設" /><PlainLabel /></Button>);
    expect(button).toHaveAccessibleName("削除 別の施設 詳細");
    expect(button.querySelector("strong .ruby-text")).toHaveTextContent("別の施設");
    view.unmount();
  });

  it("ルビ切替後も入れ子ラベルとアイコンを置換せず状態を更新できること", () => {
    const content = (name: string, hidden: boolean) => (
      <Button onClick={mockOnClick} loading={hidden}>
        <><svg aria-hidden="true" data-testid="nested-icon" className={hidden ? "hidden" : "visible"}><path d="M0 0" /></svg>
          <span><strong>{name}</strong></span></>
      </Button>
    );
    const view = render(content("確認", false));
    const icon = screen.getByTestId("nested-icon");
    const path = icon.querySelector("path");
    const button = screen.getByRole("button", { name: "確認" });
    for (let i = 0; i < 2; i++) {
      replaceRubyTargets(view.container);
      expect(button).toHaveAccessibleName("確認");
      view.container.querySelectorAll(".ruby-text").forEach((target) => {
        target.textContent = "確認";
      });
    }
    replaceRubyTargets(view.container);
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
    view.rerender(content("処理中", true));
    expect(button).toHaveAccessibleName("処理中");
    expect(button).toBeDisabled();
    expect(screen.getByTestId("nested-icon")).toBe(icon);
    expect(icon.querySelector("path")).toBe(path);
    expect(icon).toHaveClass("hidden");
    replaceRubyTargets(view.container);
    view.rerender(content("完了", false));
    expect(button).toHaveAccessibleName("完了");
    expect(button.querySelector(".ruby-text")).toHaveTextContent("完了");
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it("明示したボタン名をルビ変換後も優先すること", () => {
    const view = render(<Button aria-label="施設を削除">削除 <strong>施設名</strong></Button>);
    replaceRubyTargets(view.container);
    expect(screen.getByRole("button")).toHaveAccessibleName("施設を削除");
  });

  it("不要な自動IDを生成しないこと", () => {
    render(
      <Button onClick={mockOnClick} testId="test-button">
        ボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button.id).toBe("");
  });

  it("アイコンのみのボタンで警告に依存しないこと", () => {
    render(
      <Button onClick={mockOnClick} iconOnly testId="test-button">
        <span>🔍</span>
      </Button>
    );

    expect(screen.getByTestId("test-button")).toBeInTheDocument();
  });

  it("アイコンのみのボタンにaria-labelが設定されていれば警告が発生しないこと", () => {
    render(
      <Button
        onClick={mockOnClick}
        iconOnly
        aria-label="検索"
        testId="test-button"
      >
        <span>🔍</span>
      </Button>
    );

    expect(screen.getByTestId("test-button")).toHaveAccessibleName("検索");
  });

  it("テキストサイズ変更用のクラスが適用されていること", () => {
    render(
      <Button onClick={mockOnClick} testId="test-button">
        ボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toHaveClass("leading-relaxed");
  });
});
