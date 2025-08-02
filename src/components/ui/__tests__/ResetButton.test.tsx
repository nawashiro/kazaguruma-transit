import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ResetButton from "../ResetButton";

describe("ResetButton", () => {
  const mockOnReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("リセットボタンが正しくレンダリングされ、クリックイベントが発火すること", () => {
    render(<ResetButton onReset={mockOnReset} testId="test-reset-button" />);

    const button = screen.getByTestId("test-reset-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("検索条件をリセット");

    fireEvent.click(button);
    expect(mockOnReset).toHaveBeenCalledTimes(1);
  });

  it("カスタムクラス名が適用されること", () => {
    render(
      <ResetButton
        onReset={mockOnReset}
        className="custom-class"
        testId="test-reset-button"
      />
    );

    const container = screen.getByTestId("test-reset-button").closest("div");
    expect(container).toHaveClass("custom-class");
  });

  it("アクセシビリティのためのタッチターゲットサイズが確保されていること", () => {
    render(<ResetButton onReset={mockOnReset} testId="test-reset-button" />);

    const button = screen.getByTestId("test-reset-button");
    expect(button).toHaveClass("min-h-[44px]");
    expect(button).toHaveClass("min-w-[44px]");
  });
});
