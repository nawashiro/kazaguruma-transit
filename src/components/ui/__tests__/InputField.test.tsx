import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import InputField from "../InputField";

describe("InputField", () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("入力フィールドをラベルなしで表示する", () => {
    render(
      <InputField
        value="テスト値"
        onChange={mockOnChange}
        testId="test-input"
      />
    );

    expect(screen.getByTestId("test-input")).toHaveValue("テスト値");
    expect(screen.queryByText("テストラベル")).not.toBeInTheDocument();
  });

  it("入力欄の外観をDaisyUIのinputスタイルに委任する", () => {
    render(
      <InputField value="" onChange={mockOnChange} testId="test-input" />
    );

    const input = screen.getByTestId("test-input");
    expect(input).toHaveClass("input");
    expect(input).not.toHaveClass(
      "outline",
      "border",
      "border-base-300",
      "hover:border-base-content/50"
    );
  });

  it("値が変更されたときにonChangeが呼ばれる", () => {
    render(
      <InputField value="テスト値" onChange={mockOnChange} testId="test-input" />
    );

    fireEvent.change(screen.getByTestId("test-input"), {
      target: { value: "新しい値" },
    });
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  it("必須フィールドにrequired属性とaria-required属性を設定する", () => {
    render(
      <InputField
        value=""
        onChange={mockOnChange}
        required
        testId="test-input"
      />
    );

    const input = screen.getByTestId("test-input");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAttribute("required");
  });

  it("プレースホルダーを表示する", () => {
    render(
      <InputField
        value=""
        onChange={mockOnChange}
        placeholder="テストプレースホルダー"
        testId="test-input"
      />
    );

    expect(screen.getByTestId("test-input")).toHaveAttribute(
      "placeholder",
      "テストプレースホルダー"
    );
  });

  it("エラー状態を表示する", () => {
    render(
      <InputField
        value=""
        onChange={mockOnChange}
        error="エラーメッセージ"
        testId="test-input"
      />
    );

    const input = screen.getByTestId("test-input");
    expect(screen.getByText("エラーメッセージ")).toBeInTheDocument();
    expect(screen.getByRole("alert").querySelector("svg")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("エラーメッセージ");
  });

  it("説明テキストとエラーをaria-describedbyで参照する", () => {
    render(
      <InputField
        value=""
        onChange={mockOnChange}
        description="入力の説明テキスト"
        error="エラーメッセージ"
        testId="test-input"
      />
    );

    const input = screen.getByTestId("test-input");
    const describedByIds = input.getAttribute("aria-describedby")?.split(" ");
    expect(describedByIds).toHaveLength(2);
    expect(describedByIds).toContain(screen.getByText("入力の説明テキスト").id);
    expect(describedByIds).toContain(screen.getByText(/エラーメッセージ/).id);
  });

  it("無効状態を表示する", () => {
    render(
      <InputField
        value=""
        onChange={mockOnChange}
        disabled
        testId="test-input"
      />
    );

    const input = screen.getByTestId("test-input");
    expect(input).toBeDisabled();
    expect(input).toHaveClass("opacity-70", "cursor-not-allowed");
  });

  it("タッチターゲットとテキストサイズ用のクラスを設定する", () => {
    render(
      <InputField value="" onChange={mockOnChange} testId="test-input" />
    );

    expect(screen.getByTestId("test-input")).toHaveClass(
      "min-h-[44px]",
      "leading-relaxed"
    );
  });

  it("name属性とmaxLength属性を設定する", () => {
    render(
      <InputField
        value=""
        onChange={mockOnChange}
        name="test-name"
        maxLength={50}
        testId="test-input"
      />
    );

    const input = screen.getByTestId("test-input");
    expect(input).toHaveAttribute("name", "test-name");
    expect(input).toHaveAttribute("maxLength", "50");
  });
});
