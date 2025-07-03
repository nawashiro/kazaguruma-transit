import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import Button from "../Button";
import { logger } from "@/utils/logger";

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

  it("一意のIDが各ボタンに割り当てられていること", () => {
    render(
      <Button onClick={mockOnClick} testId="test-button">
        ボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    expect(button.id).toBeTruthy();
  });

  it("アイコンのみのボタンで警告が発生すること", () => {
    render(
      <Button onClick={mockOnClick} iconOnly testId="test-button">
        <span>🔍</span>
      </Button>
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "アイコンのみのボタンにはaria-label属性が必要です"
    );
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

    expect(logger.warn).not.toHaveBeenCalled();
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
