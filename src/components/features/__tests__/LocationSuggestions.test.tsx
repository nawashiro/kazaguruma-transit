import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationSuggestions from "../LocationSuggestions";

jest.mock("@/utils/addressLoader", () => ({
  loadAddressData: jest.fn().mockResolvedValue([
    {
      category: "公共施設",
      locations: [{ name: "千代田区役所", address: "東京都千代田区" }],
    },
  ]),
  convertToLocation: jest.fn((location) => location),
}));

const addressLoaderMock = jest.requireMock("@/utils/addressLoader") as {
  loadAddressData: jest.Mock;
};
const mockLoadAddressData = addressLoaderMock.loadAddressData;

describe("LocationSuggestions", () => {
  beforeEach(() => {
    mockLoadAddressData.mockReset();
    mockLoadAddressData.mockResolvedValue([
      {
        category: "公共施設",
        locations: [{ name: "千代田区役所", address: "東京都千代田区" }],
      },
    ]);
  });

  it("場所選択ボタンの内容を44px領域内で中央揃えにする", async () => {
    render(<LocationSuggestions onLocationSelected={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "公共施設" })).toBeInTheDocument()
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "公共施設" }));
    });

    const locationButton = await screen.findByRole("button", {
      name: "千代田区役所",
    });
    expect(locationButton).toHaveClass(
      "flex",
      "min-h-[44px]",
      "w-full",
      "items-center"
    );
  });

  it("施設データ取得失敗をエラーアイコン付きalertとして通知する", async () => {
    mockLoadAddressData.mockRejectedValueOnce(
      new Error("住所データの取得に失敗しました")
    );

    render(<LocationSuggestions onLocationSelected={jest.fn()} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/^住所データの読み込みに失敗しました$/);
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(alert).toHaveClass("alert-soft", "text-base-content!");
    expect(alert.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});
