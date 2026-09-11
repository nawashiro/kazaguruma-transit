import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Home from "../page";
import type { LocationArtifactReadResult } from "@/lib/location/location-artifact";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockReadLocationArtifact = jest.fn();

const mockArtifactResult: LocationArtifactReadResult = {
  status: "success",
  artifact: {
    status: "validated",
    sourceUris: {
      mainFacilitiesUri: "https://fixtures.example.test/v2/main_facilities.json",
      keyLocationsUri: "https://fixtures.example.test/v2/key_locations.json",
      townGeoJsonUri: "https://fixtures.example.test/v2/chiyoda-towns.geojson",
    },
    sources: {
      mainFacilities: [
        {
          category: "公共施設",
          "category:en": "public-facilities",
          locations: [
            {
              name: "テスト施設",
              lat: 35.69,
              lng: 139.75,
              copyright: "テスト著作権",
              licence: "CC BY 4.0",
              licenceUri: "https://creativecommons.org/licenses/by/4.0/",
            },
          ],
        },
      ],
      keyLocations: [],
      townGeoJson: {
        type: "FeatureCollection",
        features: [],
      },
    },
    derivedRegions: {},
  },
};

jest.mock("@/lib/location/location-artifact", () => ({
  readLocationArtifact: (...args: unknown[]) => mockReadLocationArtifact(...args),
}));

jest.mock("@/components/features/DateTimeSelector", () => function MockDateTimeSelector() {
  return <div />;
});
jest.mock("@/components/features/OriginSelector", () => function MockOriginSelector() {
  return <div />;
});
jest.mock("@/components/features/DestinationSelector", () => function MockDestinationSelector() {
  return <div />;
});
jest.mock("@/components/features/IntegratedRouteDisplay", () => function MockIntegratedRouteDisplay() {
  return <div />;
});
jest.mock("@/components/features/RoutePdfExport", () => function MockRoutePdfExport() {
  return <div />;
});
jest.mock("@/components/ui/Button", () => function MockButton({ children }: { children: React.ReactNode }) {
  return <button>{children}</button>;
});
jest.mock("@/components/ui/ResetButton", () => function MockResetButton() {
  return <button>リセット</button>;
});

async function renderPublicHome() {
  const homeElement = await Home();
  return render(<main id="main-content">{homeElement}</main>);
}

describe("Home navigation contract", () => {
  it("目的地ディープリンクを読み込み、初期画面を表示する", async () => {
    window.history.replaceState(
      {},
      "",
      "/?destination=" + encodeURIComponent(JSON.stringify({ lat: 35.7, lng: 139.78, address: "テスト目的地" })),
    );
    mockReadLocationArtifact.mockReturnValue(mockArtifactResult);

    await renderPublicHome();

    expect(await screen.findByText("テスト目的地")).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });
});
