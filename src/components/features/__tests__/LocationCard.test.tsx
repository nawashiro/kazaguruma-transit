import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationCard from "../LocationCard";
import type { KeyLocation } from "@/utils/addressLoader";

jest.mock("@/lib/location/location-list-state", () => ({
  ...jest.requireActual("@/lib/location/location-list-state"),
  findLocationAreaName: jest.fn(),
}));

const locationListStateMock = jest.requireMock(
  "@/lib/location/location-list-state",
) as { findLocationAreaName: jest.Mock };
const mockFindLocationAreaName = locationListStateMock.findLocationAreaName;

describe("LocationCard", () => {
  beforeEach(() => {
    mockFindLocationAreaName.mockReset();
    (global.fetch as jest.Mock).mockReset();
  });

  it("keeps the visible card content in the link accessible name", () => {
    const location: KeyLocation = {
      id: "location-1",
      name: "施設名",
      lat: 35.6938,
      lng: 139.7532,
      description: "案内文",
      nodeCopyright: "データ提供元",
      licence: "CC BY",
      licenceUri: "https://example.test/license",
    };

    render(<LocationCard location={location} areaName="千代田区" />);

    const link = screen.getByRole("link");

    expect(link).not.toHaveAttribute("aria-label");
    expect(link).toHaveAccessibleName(/施設名/);
    expect(link).toHaveAccessibleName(/千代田区/);
    expect(link).toHaveAccessibleName(/案内文/);
  });

  it("uses the precomputed area name and new detail URL without resolving GeoJSON", () => {
    const location: KeyLocation = {
      id: "location-日本",
      name: "施設名",
      lat: 35.6938,
      lng: 139.7532,
      nodeCopyright: "データ提供元",
      licence: "CC BY",
      licenceUri: "https://example.test/license",
    };

    render(<LocationCard location={location} areaName="九段南" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      `/locations/location-detail/${encodeURIComponent(location.id)}`,
    );
    expect(link).toHaveTextContent("九段南");
    expect(mockFindLocationAreaName).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
