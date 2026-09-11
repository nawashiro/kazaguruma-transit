import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Location } from "@/types/core";
import type {
  AddressCategory,
  AddressLocation,
} from "@/utils/addressLoader";
import LocationSuggestions from "../LocationSuggestions";

const mockConvertToLocation = jest.fn(
  (location: AddressLocation): Location => ({
    lat: location.lat,
    lng: location.lng,
    address: location.name,
  }),
);

jest.mock("@/utils/addressLoader", () => ({
  convertToLocation: (location: AddressLocation) => mockConvertToLocation(location),
}));

const popularFacility: AddressLocation = {
  name: "千代田区役所",
  lat: 35.694,
  lng: 139.753,
  copyright: "千代田区",
  licence: "CC BY 4.0",
  licenceUri: "https://creativecommons.org/licenses/by/4.0/",
};

const popularCategories: AddressCategory[] = [
  {
    category: "公共施設",
    "category:en": "public-facilities",
    locations: [popularFacility],
  },
];

type PlannedLocationSuggestionsProps = {
  categories: AddressCategory[];
  onLocationSelected: (location: Location) => void;
};

function renderWithInjectedCategories(
  onLocationSelected: (location: Location) => void,
) {
  return render(
    React.createElement(
      LocationSuggestions as unknown as React.ComponentType<PlannedLocationSuggestionsProps>,
      {
        categories: popularCategories,
        onLocationSelected,
      },
    ),
  );
}

describe("LocationSuggestions", () => {
  let browserFetchSpy: jest.SpyInstance;

  beforeEach(() => {
    mockConvertToLocation.mockClear();
    browserFetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    browserFetchSpy.mockRestore();
  });

  it("serverから注入されたcategoriesを使い、場所選択ボタンを44px領域内で中央揃えにする", async () => {
    renderWithInjectedCategories(jest.fn());

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "公共施設" })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("tab", { name: "公共施設" }));

    const locationButton = await screen.findByRole("button", {
      name: "千代田区役所",
    });
    expect(locationButton).toHaveClass(
      "flex",
      "min-h-[44px]",
      "w-full",
      "items-center",
    );
    expect(browserFetchSpy).not.toHaveBeenCalled();
  });

  it("注入されたpopular施設を既存のdestination callbackへLocationとして引き渡す", async () => {
    const onLocationSelected = jest.fn();
    renderWithInjectedCategories(onLocationSelected);

    fireEvent.click(await screen.findByRole("tab", { name: "公共施設" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "千代田区役所" }),
    );

    expect(browserFetchSpy).not.toHaveBeenCalled();
    expect(mockConvertToLocation).toHaveBeenCalledWith(popularFacility);
    expect(onLocationSelected).toHaveBeenCalledWith({
      lat: popularFacility.lat,
      lng: popularFacility.lng,
      address: popularFacility.name,
    });
  });
});
