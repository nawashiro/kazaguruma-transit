import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import NearestStopFinder from "../NearestStopFinder";
import { Location } from "../../types/transit";

// モックのfetch API
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

describe("NearestStopFinder", () => {
  const mockLocation: Location = {
    lat: 36.3949,
    lng: 140.4797,
    address: "茨城県ひたちなか市",
  };

  const mockNearestStop = {
    stop_id: "stop2",
    stop_name: "ひたちなか市役所",
    distance: 0.5,
  };

  const mockOnStopSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("指定された位置から最寄りのバス停を取得して自動選択する", async () => {
    // APIレスポンスのモック
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        stops: [],
        nearestStop: mockNearestStop,
      }),
    });

    render(
      <NearestStopFinder
        userLocation={mockLocation}
        onStopSelected={mockOnStopSelected}
      />
    );

    // ローディング状態が表示される
    expect(screen.getByText("最寄りのバス停を検索中...")).toBeInTheDocument();

    // APIが呼ばれ、最寄りのバス停が選択される
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/transit/nearest-stop?lat=${mockLocation.lat}&lng=${mockLocation.lng}`
      );
      expect(mockOnStopSelected).toHaveBeenCalledWith({
        stop_id: mockNearestStop.stop_id,
        stop_name: mockNearestStop.stop_name,
        distance: mockNearestStop.distance,
      });
    });

    // 成功すると何も表示されない（nullが返される）
    expect(
      screen.queryByText("最寄りのバス停を検索中...")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/最寄りのバス停/)).not.toBeInTheDocument();
  });

  it("バス停が取得できなかった場合エラーメッセージが表示される", async () => {
    // 空の結果を返すモック
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ stops: [], nearestStop: null }),
    });

    render(
      <NearestStopFinder
        userLocation={mockLocation}
        onStopSelected={mockOnStopSelected}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("近くにバス停が見つかりませんでした")
      ).toBeInTheDocument();
      expect(mockOnStopSelected).not.toHaveBeenCalled();
    });
  });

  it("APIエラーの場合はエラーメッセージが表示される", async () => {
    // エラーレスポンスのモック
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "バス停の取得に失敗しました" }),
    });

    render(
      <NearestStopFinder
        userLocation={mockLocation}
        onStopSelected={mockOnStopSelected}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("バス停の取得に失敗しました")
      ).toBeInTheDocument();
      expect(mockOnStopSelected).not.toHaveBeenCalled();
    });
  });
});
