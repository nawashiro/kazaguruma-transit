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
    const arrivalTab = screen.getByTestId("arrival-radio");
    fireEvent.click(arrivalTab);

    // 到着日時入力フィールドが表示されていることを確認
    await waitFor(() => {
      expect(screen.getByTestId("arrival-label")).toHaveTextContent("到着日時");
      expect(screen.getByTestId("arrival-input")).toBeInTheDocument();
    });

    // タブ切り替え時にonDateTimeSelectedが呼ばれ、isDepartureがfalseになることを確認
    expect(mockOnDateTimeSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        stopId: mockStopId,
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

  it("アクセシビリティ：時間タイプがネイティブラジオとして公開されていること", async () => {
    render(
      <DateTimeSelector
        initialStopId={mockStopId}
        onSubmit={mockOnSubmit}
        onDateTimeSelected={mockOnDateTimeSelected}
      />
    );

    // fieldset/legendのラジオグループ契約を維持する
    const fieldsetRadiogroup = screen.getByRole("radiogroup");
    expect(fieldsetRadiogroup).toBeInTheDocument();

    const labelId = fieldsetRadiogroup.getAttribute("aria-labelledby");
    const label = document.getElementById(labelId || "");
    expect(label).toHaveTextContent("時間タイプを選択");

    // roleを付けた別要素ではなく、実DOMのネイティブラジオを要求する
    const radioInputs = Array.from(
      fieldsetRadiogroup.querySelectorAll('input[type="radio"]')
    );
    expect(radioInputs).toHaveLength(2);
    radioInputs.forEach((radioInput) => {
      expect(radioInput).toBeInstanceOf(HTMLInputElement);
      expect(radioInput.tagName).toBe("INPUT");
      expect(radioInput).toHaveAttribute("name");
      expect(radioInput.getAttribute("name")).not.toBe("");
      expect(radioInput).toHaveAttribute("id");
      expect(radioInput.getAttribute("id")).not.toBe("");
    });
    expect(radioInputs[0].getAttribute("name")).toBe(
      radioInputs[1].getAttribute("name")
    );

    // labelの公開経路で同じinputを取得し、htmlForの関連付けを検証する
    const departureRadio = screen.getByLabelText("出発");
    const arrivalRadio = screen.getByLabelText("到着");
    expect(departureRadio).toBeInstanceOf(HTMLInputElement);
    expect(arrivalRadio).toBeInstanceOf(HTMLInputElement);
    expect(departureRadio).toHaveAttribute("type", "radio");
    expect(arrivalRadio).toHaveAttribute("type", "radio");

    const departureLabel = departureRadio.closest("label") as HTMLLabelElement | null;
    const arrivalLabel = arrivalRadio.closest("label") as HTMLLabelElement | null;
    expect(departureLabel).not.toBeNull();
    expect(arrivalLabel).not.toBeNull();
    if (!departureLabel || !arrivalLabel) {
      throw new Error("Native radio labels are missing");
    }
    expect(departureLabel.tagName).toBe("LABEL");
    expect(arrivalLabel.tagName).toBe("LABEL");
    expect(departureLabel.htmlFor).not.toBe("");
    expect(arrivalLabel.htmlFor).not.toBe("");
    expect(departureLabel.htmlFor).toBe(departureRadio.id);
    expect(arrivalLabel.htmlFor).toBe(arrivalRadio.id);
    expect(fieldsetRadiogroup.querySelector(".join")).toBeNull();
    expect(departureLabel).not.toHaveClass("btn", "join-item", "btn-primary");
    expect(arrivalLabel).not.toHaveClass("btn", "join-item", "btn-primary");

    // 初期選択とネイティブinputのクリックによる切り替えを検証する
    expect(departureRadio).toBeChecked();
    expect(arrivalRadio).not.toBeChecked();
    mockOnDateTimeSelected.mockClear();
    fireEvent.click(arrivalRadio);

    await waitFor(() => {
      expect(arrivalRadio).toBeChecked();
      expect(departureRadio).not.toBeChecked();
      expect(screen.getByTestId("arrival-label")).toHaveTextContent("到着日時");
      expect(screen.getByTestId("arrival-input")).toBeInTheDocument();
      expect(mockOnDateTimeSelected).toHaveBeenCalledWith(
        expect.objectContaining({
          stopId: mockStopId,
          isDeparture: false,
        })
      );
    });
  });

  it("アクセシビリティ：日時入力フィールドが適切なaria属性を持つこと", () => {
    render(
      <DateTimeSelector initialStopId={mockStopId} onSubmit={mockOnSubmit} />
    );

    // 日時入力フィールドのaria属性確認
    const dateTimeInput = screen.getByTestId("departure-input");
    expect(dateTimeInput).toHaveAttribute("aria-required", "true");

    // 到着時間に切り替えた場合のaria属性確認
    const arrivalBtn = screen.getByTestId("arrival-radio");
    fireEvent.click(arrivalBtn);

    const arrivalInput = screen.getByTestId("arrival-input");
    expect(arrivalInput).toHaveAttribute("aria-required", "true");
  });

  it("アクセシビリティ：無効状態のボタンが適切に処理されること", () => {
    render(
      <DateTimeSelector
        initialStopId={mockStopId}
        onSubmit={mockOnSubmit}
        disabled={true}
      />
    );

    // ラジオボタンが無効状態になることを確認
    const departureRadio = screen.getByTestId("departure-radio");
    const arrivalRadio = screen.getByTestId("arrival-radio");
    expect(departureRadio).toBeDisabled();
    expect(arrivalRadio).toBeDisabled();

    // 無効状態の入力フィールドチェック
    const dateTimeInput = screen.getByTestId("departure-input");
    expect(dateTimeInput).toBeDisabled();
  });
});
