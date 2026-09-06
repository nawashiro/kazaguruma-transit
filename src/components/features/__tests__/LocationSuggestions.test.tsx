import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationSuggestions from "../LocationSuggestions";

jest.mock("@/utils/addressLoader", () => ({
  loadAddressData: jest.fn().mockResolvedValue([
    {
      category: "公共施設",
      locations: [{ name: "千代田区役所", lat: 35.6941626, lng: 139.7535624 }],
    },
  ]),
  convertToLocation: jest.fn((location) => ({
    lat: location.lat,
    lng: location.lng,
    address: location.name,
  })),
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
        locations: [{ name: "千代田区役所", lat: 35.6941626, lng: 139.7535624 }],
      },
    ]);
  });

  it("候補施設をインラインのnative selectとoptgroup/optionで表示し、選択しても遷移しない", async () => {
    const onLocationSelected = jest.fn();
    render(<LocationSuggestions onLocationSelected={onLocationSelected} />);

    await act(async () => {
      await Promise.resolve();
    });
    const select = screen.queryByRole("combobox", { name: /施設|候補/ });
    expect(select).not.toBeNull();
    if (!select) return;

    expect(select.tagName).toBe("SELECT");
    expect(select.querySelectorAll("optgroup")).toHaveLength(1);
    expect(select.querySelector("optgroup")?.label).toBe("公共施設");
    expect(select.querySelector("option")).toHaveTextContent("千代田区役所");
    expect(select.querySelector("form")).toBeNull();

    fireEvent.change(select, { target: { value: "35.6941626,139.7535624" } });

    expect(onLocationSelected).toHaveBeenCalledWith({
      lat: 35.6941626,
      lng: 139.7535624,
      address: "千代田区役所",
    });
    expect(window.location.pathname).toBe("/");
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
