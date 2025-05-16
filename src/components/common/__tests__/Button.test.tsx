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

  it("セカンダリスタイルが適切に表示されること", () => {
    render(
      <Button onClick={mockOnClick} secondary testId="test-button">
        セカンダリボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    // セカンダリボタンは白背景と灰色のテキストを使用
    expect(button).toHaveClass("bg-white");
    expect(button).toHaveClass("text-gray-700");
  });

  it("ローディング状態が適切に表示されること", () => {
    render(
      <Button onClick={mockOnClick} loading testId="test-button">
        ボタン
      </Button>
    );

    const button = screen.getByTestId("test-button");
    const spinner = screen
      .getByTestId("test-button")
      .querySelector(".loading.loading-spinner");
    expect(spinner).toBeInTheDocument();
    expect(button).toBeDisabled();
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
});
