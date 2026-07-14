import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Button from "../Button";

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

    // ローディング状態では視覚的な無効状態のスタイルが適用される
    expect(button).toHaveClass("opacity-70");
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

  it("複合コンテンツをボタン内で中央揃えにすること", () => {
    render(
      <Button testId="test-button">
        <span data-testid="button-content">内容</span>
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button).toHaveClass("inline-flex", "items-center", "justify-center");
    expect(button.querySelector(".ruby-text")).toHaveClass(
      "items-center",
      "justify-center"
    );
  });

  it("日本語の表示文字列をruby-text内に配置すること", () => {
    render(<Button testId="test-button">確認</Button>);

    expect(screen.getByTestId("test-button").querySelector(".ruby-text")).toHaveTextContent(
      "確認"
    );
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
