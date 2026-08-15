import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LocationCard from "../LocationCard";
import type { KeyLocation } from "@/utils/addressLoader";

describe("LocationCard", () => {
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
});
