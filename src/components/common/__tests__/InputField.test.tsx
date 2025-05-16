import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import InputField from "../InputField";

describe("InputField", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("基本的なラベルと入力フィールドが表示されること", () => {
    render(
      <InputField
        label="テストラベル"
        value="テスト値"
        onChange={mockOnChange}
        testId="test-input"
      />
    );

    const label = screen.getByText("テストラベル");
    expect(label).toBeInTheDocument();

    const input = screen.getByTestId("test-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("テスト値");
  });

  it("値が変更されたときにonChangeが呼ばれること", () => {
    render(
      <InputField
        label="テストラベル"
        value="テスト値"
        onChange={mockOnChange}
        testId="test-input"
      />
    );

    const input = screen.getByTestId("test-input");
    fireEvent.change(input, { target: { value: "新しい値" } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it("必須フィールドが視覚的に区別されること", () => {
    render(
      <InputField
        label="テストラベル"
        value=""
        onChange={mockOnChange}
        required={true}
        testId="test-input"
      />
    );

    // 必須マーク（アスタリスク）が表示されることを確認
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("プレースホルダーが表示されること", () => {
    render(
      <InputField
        label="テストラベル"
        value=""
        onChange={mockOnChange}
        placeholder="テストプレースホルダー"
        testId="test-input"
      />
    );

    const input = screen.getByTestId("test-input");
    expect(input).toHaveAttribute("placeholder", "テストプレースホルダー");
  });

  it("エラー状態が適切に表示されること", () => {
    render(
      <InputField
        label="テストラベル"
        value=""
        onChange={mockOnChange}
        error="エラーメッセージ"
        testId="test-input"
      />
    );

    // エラーメッセージが表示されることを確認
    expect(screen.getByText("エラーメッセージ")).toBeInTheDocument();

    // aria-invalid属性が設定されていることを確認
    const input = screen.getByTestId("test-input");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("説明テキストが表示され、適切にaria-describedbyが設定されること", () => {
    render(
      <InputField
        label="テストラベル"
        value=""
        onChange={mockOnChange}
        description="入力の説明テキスト"
        testId="test-input"
      />
    );

    // 説明テキストが表示されることを確認
    expect(screen.getByText("入力の説明テキスト")).toBeInTheDocument();

    // aria-describedby属性が設定されていることを確認
    const input = screen.getByTestId("test-input");
    const descriptionId = input.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();

    // 説明テキストのid属性が一致することを確認
    const descriptionElement = screen.getByText("入力の説明テキスト");
    expect(descriptionElement.id).toBe(descriptionId);
  });

  it("無効状態が適切に表示されること", () => {
    render(
      <InputField
        label="テストラベル"
        value=""
        onChange={mockOnChange}
        disabled={true}
        testId="test-input"
      />
    );

    const input = screen.getByTestId("test-input");
    expect(input).toBeDisabled();
  });

  it("アクセシビリティのためのタッチターゲットサイズが確保されていること", () => {
    render(
      <InputField
        label="テストラベル"
        value=""
        onChange={mockOnChange}
        testId="test-input"
      />
    );

    const input = screen.getByTestId("test-input");
    expect(input).toHaveClass("min-h-[44px]");
  });
});
