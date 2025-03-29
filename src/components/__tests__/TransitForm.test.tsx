import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import TransitForm from "../TransitForm";

// モックフェッチの実装
global.fetch = jest.fn();

describe("TransitForm", () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    jest.clearAllMocks();

    // メタデータ取得のモック
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stops: [
          { id: "stop1", name: "大手町" },
          { id: "stop2", name: "国会議事堂前" },
        ],
        routes: [
          { id: "route1", name: "千代田線" },
          { id: "route2", name: "日比谷線" },
        ],
      }),
    });
  });

  it("renders the form correctly", async () => {
    render(<TransitForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText("乗換案内")).toBeInTheDocument();

    // APIからデータが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByText("大手町")).toBeInTheDocument();
    });

    // メタデータを取得するためのAPIが呼ばれたことを確認
    expect(global.fetch).toHaveBeenCalledWith("/api/transit?dataType=metadata");
  });

  it("shows validation error when submitting without selecting a stop", async () => {
    render(<TransitForm onSubmit={mockOnSubmit} />);

    // データが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByText("大手町")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("submit-button"));

    expect(screen.getByText("駅を選択してください")).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit when form is submitted with valid data", async () => {
    render(<TransitForm onSubmit={mockOnSubmit} />);

    // データが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByText("大手町")).toBeInTheDocument();
    });

    // 駅を選択
    fireEvent.change(screen.getByTestId("stop-select"), {
      target: { value: "stop1" },
    });

    // 路線を選択
    fireEvent.change(screen.getByTestId("route-select"), {
      target: { value: "route1" },
    });

    // 送信
    fireEvent.click(screen.getByTestId("submit-button"));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      stopId: "stop1",
      routeId: "route1",
    });
  });

  it("submits the form with only stop ID when route is not selected", async () => {
    render(<TransitForm onSubmit={mockOnSubmit} />);

    // データが読み込まれるのを待つ
    await waitFor(() => {
      expect(screen.getByText("大手町")).toBeInTheDocument();
    });

    // 駅を選択
    fireEvent.change(screen.getByTestId("stop-select"), {
      target: { value: "stop1" },
    });

    // 送信
    fireEvent.click(screen.getByTestId("submit-button"));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      stopId: "stop1",
      routeId: undefined,
    });
  });
});
