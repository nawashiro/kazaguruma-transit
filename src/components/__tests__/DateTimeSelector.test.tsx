import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DateTimeSelector from "../DateTimeSelector";

describe("DateTimeSelector", () => {
  const mockStopId = "stop1";
  const mockOnSubmit = jest.fn();
  const mockOnDateTimeSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("出発日時入力フィールドが表示され、値を入力できること", () => {
    render(
      <DateTimeSelector initialStopId={mockStopId} onSubmit={mockOnSubmit} />
    );

    // 出発日時入力フィールドが存在することを確認
    const departureDateTimeInput = screen.getByTestId("departure-input");
    expect(departureDateTimeInput).toBeInTheDocument();
    expect(screen.getByTestId("departure-label")).toHaveTextContent("出発日時");

    // 値を設定
    fireEvent.change(departureDateTimeInput, {
      target: { value: "2023-11-01T09:00" },
    });
    expect(departureDateTimeInput).toHaveValue("2023-11-01T09:00");

    // 値変更時にonSubmitが呼ばれることを確認
    expect(mockOnSubmit).toHaveBeenCalledWith({
      stopId: mockStopId,
      dateTime: "2023-11-01T09:00",
      isDeparture: true,
    });
  });

  it("出発/到着切り替えが機能し、到着日時入力フィールドに切り替わること", async () => {
    render(
      <DateTimeSelector
        initialStopId={mockStopId}
        onSubmit={mockOnSubmit}
        onDateTimeSelected={mockOnDateTimeSelected}
      />
    );

    // デフォルトでは出発日時が表示されていることを確認
    expect(screen.getByTestId("departure-label")).toHaveTextContent("出発日時");

    // モックがコンポーネント初期化時に呼ばれたことをリセット
    mockOnDateTimeSelected.mockClear();

    // 到着タブをクリック
    const arrivalTab = screen.getByTestId("arrival-tab");
    fireEvent.click(arrivalTab);

    // 到着日時入力フィールドが表示されていることを確認
    await waitFor(() => {
      expect(screen.getByTestId("arrival-label")).toHaveTextContent("到着日時");
      expect(screen.getByTestId("arrival-input")).toBeInTheDocument();
    });

    // タブ切り替え時にonDateTimeSelectedが呼ばれ、isDepartureがfalseになることを確認
    expect(mockOnDateTimeSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        isDeparture: false,
      })
    );
  });

  it("初期値が設定され、onSubmitが初期化時に呼ばれること", async () => {
    render(
      <DateTimeSelector initialStopId={mockStopId} onSubmit={mockOnSubmit} />
    );

    // コンポーネント初期化時にonSubmitが呼ばれることを確認
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          stopId: mockStopId,
          isDeparture: true,
        })
      );
    });
  });

  // アクセシビリティに関するテストを追加
  it("アクセシビリティ：ラジオグループが適切に実装されていること", () => {
    render(
      <DateTimeSelector initialStopId={mockStopId} onSubmit={mockOnSubmit} />
    );

    // ラジオグループのrole属性を検証
    const radiogroup = screen.getByRole("radiogroup");
    expect(radiogroup).toBeInTheDocument();

    // ラジオグループにaria-labelledby属性があることを確認
    expect(radiogroup).toHaveAttribute("aria-labelledby", expect.any(String));

    // 隠れたラベルテキストが存在することを確認
    const labelId = radiogroup.getAttribute("aria-labelledby");
    const label = document.getElementById(labelId || "");
    expect(label).toHaveTextContent("時間タイプを選択");
  });

  it("アクセシビリティ：出発/到着ボタンが適切なaria属性を持つこと", () => {
    render(
      <DateTimeSelector initialStopId={mockStopId} onSubmit={mockOnSubmit} />
    );

    // 出発ボタンの属性確認
    const departureBtn = screen.getByTestId("departure-tab");
    expect(departureBtn).toHaveAttribute("aria-pressed", "true");
    expect(departureBtn).toHaveAttribute("aria-label", "出発時間を指定");

    // 到着ボタンの属性確認
    const arrivalBtn = screen.getByTestId("arrival-tab");
    expect(arrivalBtn).toHaveAttribute("aria-pressed", "false");
    expect(arrivalBtn).toHaveAttribute("aria-label", "到着時間を指定");

    // ボタンクリック時の属性変更を確認
    fireEvent.click(arrivalBtn);
    expect(departureBtn).toHaveAttribute("aria-pressed", "false");
    expect(arrivalBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("アクセシビリティ：日時入力フィールドが適切なaria属性を持つこと", () => {
    render(
      <DateTimeSelector initialStopId={mockStopId} onSubmit={mockOnSubmit} />
    );

    // 日時入力フィールドのaria属性確認
    const dateTimeInput = screen.getByTestId("departure-input");
    expect(dateTimeInput).toHaveAttribute("aria-required", "true");
    expect(dateTimeInput).toHaveAttribute(
      "aria-label",
      "いつ出発するか指定してください"
    );

    // 到着時間に切り替えた場合のaria属性確認
    const arrivalBtn = screen.getByTestId("arrival-tab");
    fireEvent.click(arrivalBtn);

    const arrivalInput = screen.getByTestId("arrival-input");
    expect(arrivalInput).toHaveAttribute("aria-required", "true");
    expect(arrivalInput).toHaveAttribute(
      "aria-label",
      "いつ到着するか指定してください"
    );
  });

  it("アクセシビリティ：無効状態のボタンが適切に処理されること", () => {
    render(
      <DateTimeSelector
        initialStopId={mockStopId}
        onSubmit={mockOnSubmit}
        disabled={true}
      />
    );

    // 無効状態のボタンチェック
    const departureBtn = screen.getByTestId("departure-tab");
    const arrivalBtn = screen.getByTestId("arrival-tab");
    expect(departureBtn).toBeDisabled();
    expect(arrivalBtn).toBeDisabled();

    // 無効状態の入力フィールドチェック
    const dateTimeInput = screen.getByTestId("departure-input");
    expect(dateTimeInput).toBeDisabled();
  });
});
