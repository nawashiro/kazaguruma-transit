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
});
