import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DateTimeSelector from "../DateTimeSelector";

describe("DateTimeSelector", () => {
  const mockStopId = "stop1";
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("出発日時入力フィールドが表示され、値を入力できること", () => {
    render(
      <DateTimeSelector initialStopId={mockStopId} onSubmit={mockOnSubmit} />
    );

    // 出発日時入力フィールドが存在することを確認
    const departureDateTimeInput = screen.getByLabelText(/出発日時/);
    expect(departureDateTimeInput).toBeInTheDocument();

    // 値を設定
    fireEvent.change(departureDateTimeInput, {
      target: { value: "2023-11-01T09:00" },
    });
    expect(departureDateTimeInput).toHaveValue("2023-11-01T09:00");
  });

  it("出発/到着切り替えが機能し、到着日時入力フィールドに切り替わること", async () => {
    render(
      <DateTimeSelector initialStopId={mockStopId} onSubmit={mockOnSubmit} />
    );

    // デフォルトでは出発日時が表示されていることを確認
    expect(screen.getByLabelText(/出発日時/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/到着日時/)).not.toBeInTheDocument();

    // 到着日時に切り替え
    const toggleButton = screen.getByRole("button", { name: /到着/ });
    fireEvent.click(toggleButton);

    // 到着日時入力フィールドが表示されていることを確認
    await waitFor(() => {
      expect(screen.queryByLabelText(/出発日時/)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/到着日時/)).toBeInTheDocument();
    });
  });

  it("フォーム送信時に日時情報が含まれること", () => {
    render(
      <DateTimeSelector initialStopId={mockStopId} onSubmit={mockOnSubmit} />
    );

    // 日時を設定
    const dateTimeInput = screen.getByLabelText(/出発日時/);
    fireEvent.change(dateTimeInput, { target: { value: "2023-11-01T09:00" } });

    // フォームを送信
    const submitButton = screen.getByRole("button", { name: /検索/ });
    fireEvent.click(submitButton);

    // onSubmitが正しいパラメータで呼ばれることを確認
    expect(mockOnSubmit).toHaveBeenCalledWith({
      stopId: mockStopId,
      dateTime: "2023-11-01T09:00",
      isDeparture: true,
    });
  });
});
