import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import OriginSelector from "../OriginSelector";
import { Location } from "../../types/transit";

// モックのgeolocation API
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

// モックのfetch API
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

// グローバルオブジェクトに追加
Object.defineProperty(global.navigator, "geolocation", {
  value: mockGeolocation,
  writable: true,
});

describe("OriginSelector", () => {
  const mockOnOriginSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // fetchのモックをリセット
    mockFetch.mockReset();
  });

  it("正しくレンダリングされる", () => {
    render(<OriginSelector onOriginSelected={mockOnOriginSelected} />);

    expect(
      screen.getByText("次に出発地を選択してください")
    ).toBeInTheDocument();
    expect(screen.getByTestId("address-input")).toBeInTheDocument();
    expect(screen.getByTestId("search-button")).toBeInTheDocument();
    expect(screen.getByTestId("gps-button")).toBeInTheDocument();
  });

  it("住所が未入力の場合はコールバックが呼ばれず検索を実行しない", async () => {
    render(<OriginSelector onOriginSelected={mockOnOriginSelected} />);

    // 空入力の状態で検索ボタンをクリック
    const searchButton = screen.getByTestId("search-button");
    fireEvent.click(searchButton);

    // コールバックが呼ばれていないことを確認
    expect(mockOnOriginSelected).not.toHaveBeenCalled();
    // APIが呼ばれていないことを確認
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("住所が入力された場合に検索を実行する", async () => {
    // APIレスポンスのモック
    const mockLocation = {
      lat: 35.6812362,
      lng: 139.7671248,
      address: "東京都千代田区丸の内１丁目",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        results: [
          {
            lat: mockLocation.lat,
            lng: mockLocation.lng,
            formattedAddress: mockLocation.address,
          },
        ],
      }),
    });

    render(<OriginSelector onOriginSelected={mockOnOriginSelected} />);

    const addressInput = screen.getByTestId("address-input");
    const searchButton = screen.getByTestId("search-button");

    fireEvent.change(addressInput, { target: { value: "東京都千代田区" } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/geocode?address=%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%8D%83%E4%BB%A3%E7%94%B0%E5%8C%BA"
      );
      expect(mockOnOriginSelected).toHaveBeenCalledTimes(1);
      expect(mockOnOriginSelected).toHaveBeenCalledWith({
        lat: mockLocation.lat,
        lng: mockLocation.lng,
        address: mockLocation.address,
      });
    });
  });

  it("APIがエラーを返した場合にエラーメッセージを表示する", async () => {
    // APIエラーのモック
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "ジオコーディングに失敗しました: ZERO_RESULTS",
      }),
    });

    render(<OriginSelector onOriginSelected={mockOnOriginSelected} />);

    const addressInput = screen.getByTestId("address-input");
    const searchButton = screen.getByTestId("search-button");

    fireEvent.change(addressInput, { target: { value: "存在しない住所" } });
    fireEvent.click(searchButton);

    expect(
      await screen.findByText("ジオコーディングに失敗しました: ZERO_RESULTS")
    ).toBeInTheDocument();
    expect(mockOnOriginSelected).not.toHaveBeenCalled();
  });

  it("現在地ボタンをクリックしたらGeolocation APIを呼び出す", () => {
    render(<OriginSelector onOriginSelected={mockOnOriginSelected} />);

    const gpsButton = screen.getByTestId("gps-button");
    fireEvent.click(gpsButton);

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("Geolocation APIが成功したら位置情報をコールバックに渡す", async () => {
    const mockPosition = {
      coords: {
        latitude: 35.681236,
        longitude: 139.767125,
      },
    };

    // 逆ジオコーディングのモック
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        results: [
          {
            lat: 35.681236,
            lng: 139.767125,
            formattedAddress: "東京都千代田区丸の内１丁目",
          },
        ],
      }),
    });

    // 成功時のコールバックをすぐに呼び出すようにモック
    mockGeolocation.getCurrentPosition.mockImplementation((success) => {
      success(mockPosition);
    });

    render(<OriginSelector onOriginSelected={mockOnOriginSelected} />);

    const gpsButton = screen.getByTestId("gps-button");
    fireEvent.click(gpsButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/geocode?address=35.681236,139.767125"
      );
      expect(mockOnOriginSelected).toHaveBeenCalledTimes(1);
      expect(mockOnOriginSelected).toHaveBeenCalledWith({
        lat: 35.681236,
        lng: 139.767125,
        address: "東京都千代田区丸の内１丁目",
      });
    });
  });

  it("Geolocation APIがエラーの場合にエラーメッセージを表示", async () => {
    // エラー時のコールバックを呼び出すようにモック
    mockGeolocation.getCurrentPosition.mockImplementation((success, error) => {
      error({ message: "User denied Geolocation" });
    });

    render(<OriginSelector onOriginSelected={mockOnOriginSelected} />);

    const gpsButton = screen.getByTestId("gps-button");
    fireEvent.click(gpsButton);

    expect(
      await screen.findByText(/位置情報の取得に失敗しました/)
    ).toBeInTheDocument();
    expect(mockOnOriginSelected).not.toHaveBeenCalled();
  });
});
