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

describe("LocationSuggestions", () => {
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
});
