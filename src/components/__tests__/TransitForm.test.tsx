import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import TransitForm from "../TransitForm";

// モックフェッチの実装
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

describe("TransitForm", () => {
  const mockStop = { stop_id: "stop1", stop_name: "テスト停留所" };
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    jest.clearAllMocks();

    // メタデータ取得のモック
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stops: [mockStop],
        routes: [
          {
            route_id: "route1",
            route_short_name: "1",
            route_long_name: "テストルート1",
          },
          {
            route_id: "route2",
            route_short_name: "2",
            route_long_name: "テストルート2",
          },
        ],
      }),
    });
  });

  it("renders the form correctly", async () => {
    render(<TransitForm onSubmit={mockOnSubmit} />);

    // 最初はローディング状態
    expect(screen.getByText("データを読み込み中...")).toBeInTheDocument();

    // APIからデータが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByLabelText(/バス停/)).toBeInTheDocument();
      expect(screen.getByText("テスト停留所")).toBeInTheDocument();
    });

    // メタデータを取得するためのAPIが呼ばれたことを確認
    expect(global.fetch).toHaveBeenCalledWith("/api/transit?dataType=metadata");
  });

  it("shows validation error when submitting without selecting a stop", async () => {
    render(<TransitForm onSubmit={mockOnSubmit} />);

    // データが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByLabelText(/バス停/)).toBeInTheDocument();
    });

    // 検索ボタンをクリック
    const submitButton = screen.getByRole("button", { name: /検索/ });
    fireEvent.click(submitButton);

    // バリデーションにより送信されない
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with the correct parameters when form is submitted", async () => {
    render(<TransitForm onSubmit={mockOnSubmit} />);

    // データが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByLabelText(/バス停/)).toBeInTheDocument();
    });

    // 駅を選択
    const stopSelect = screen.getByLabelText(/バス停/);
    fireEvent.change(stopSelect, { target: { value: "stop1" } });

    // 路線を選択
    const routeSelect = screen.getByLabelText(/路線/);
    fireEvent.change(routeSelect, { target: { value: "route1" } });

    // 送信
    const submitButton = screen.getByRole("button", { name: /検索/ });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith({
      stopId: "stop1",
      routeId: "route1",
      dateTime: expect.any(String),
      isDeparture: true,
    });
  });

  it("出発日時入力フィールドが表示され、値を入力できること", async () => {
    render(
      <TransitForm initialStopId={mockStop.stop_id} onSubmit={mockOnSubmit} />
    );

    // メタデータが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByLabelText(/バス停/)).toBeInTheDocument();
    });

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
      <TransitForm initialStopId={mockStop.stop_id} onSubmit={mockOnSubmit} />
    );

    // メタデータが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByLabelText(/バス停/)).toBeInTheDocument();
    });

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

  it("フォーム送信時に日時情報が含まれること", async () => {
    render(
      <TransitForm initialStopId={mockStop.stop_id} onSubmit={mockOnSubmit} />
    );

    // メタデータが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByLabelText(/バス停/)).toBeInTheDocument();
    });

    // バス停を選択
    const stopSelect = screen.getByLabelText(/バス停/);
    fireEvent.change(stopSelect, { target: { value: "stop1" } });

    // ルートを選択
    const routeSelect = screen.getByLabelText(/路線/);
    fireEvent.change(routeSelect, { target: { value: "route1" } });

    // 日時を設定
    const dateTimeInput = screen.getByLabelText(/出発日時/);
    fireEvent.change(dateTimeInput, { target: { value: "2023-11-01T09:00" } });

    // フォームを送信
    const submitButton = screen.getByRole("button", { name: /検索/ });
    fireEvent.click(submitButton);

    // onSubmitが正しいパラメータで呼ばれることを確認
    expect(mockOnSubmit).toHaveBeenCalledWith({
      stopId: "stop1",
      routeId: "route1",
      dateTime: "2023-11-01T09:00",
      isDeparture: true,
    });
  });
});
