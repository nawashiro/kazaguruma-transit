import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import DestinationSelector from "../DestinationSelector";
import { Location } from "../../types/transit";

// モックのfetch API
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

describe("DestinationSelector", () => {
  const mockOnDestinationSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("目的地入力フォームと検索ボタンが表示される", () => {
    render(
      <DestinationSelector onDestinationSelected={mockOnDestinationSelected} />
    );

    expect(screen.getByText("どこへ行きたいですか？")).toBeInTheDocument();
    expect(screen.getByTestId("destination-input")).toBeInTheDocument();
    expect(screen.getByTestId("search-destination-button")).toBeInTheDocument();
  });

  it("入力が空の場合にエラーメッセージを表示する", async () => {
    render(
      <DestinationSelector onDestinationSelected={mockOnDestinationSelected} />
    );

    const searchButton = screen.getByTestId("search-destination-button");
    fireEvent.click(searchButton);

    expect(
      await screen.findByText("行き先を入力してください")
    ).toBeInTheDocument();
    expect(mockOnDestinationSelected).not.toHaveBeenCalled();
  });

  it("目的地が入力された場合に検索を実行する", async () => {
    // APIレスポンスのモック
    const mockLocation = {
      lat: 35.6895,
      lng: 139.6917,
      address: "東京都千代田区霞が関１丁目",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ location: mockLocation }),
    });

    render(
      <DestinationSelector onDestinationSelected={mockOnDestinationSelected} />
    );

    const destinationInput = screen.getByTestId("destination-input");
    const searchButton = screen.getByTestId("search-destination-button");

    fireEvent.change(destinationInput, {
      target: { value: "東京都千代田区霞が関" },
    });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/geocode?address=%E6%9D%B1%E4%BA%AC%E9%83%BD%E5%8D%83%E4%BB%A3%E7%94%B0%E5%8C%BA%E9%9C%9E%E3%81%8C%E9%96%A2"
      );
      expect(mockOnDestinationSelected).toHaveBeenCalledTimes(1);
      expect(mockOnDestinationSelected).toHaveBeenCalledWith(mockLocation);
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

    render(
      <DestinationSelector onDestinationSelected={mockOnDestinationSelected} />
    );

    const destinationInput = screen.getByTestId("destination-input");
    const searchButton = screen.getByTestId("search-destination-button");

    fireEvent.change(destinationInput, { target: { value: "存在しない住所" } });
    fireEvent.click(searchButton);

    expect(
      await screen.findByText("ジオコーディングに失敗しました: ZERO_RESULTS")
    ).toBeInTheDocument();
    expect(mockOnDestinationSelected).not.toHaveBeenCalled();
  });
});
