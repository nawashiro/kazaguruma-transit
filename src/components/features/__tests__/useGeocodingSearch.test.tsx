import { act, renderHook } from "@testing-library/react";
import { searchGeocoding } from "@/lib/location/geocoding-search";
import { track } from "@/lib/analytics/tracking";
import { useGeocodingSearch } from "../useGeocodingSearch";

jest.mock("@/lib/analytics/tracking", () => ({ track: jest.fn() }));
jest.mock("@/lib/location/geocoding-search", () => ({ searchGeocoding: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const searchGeocodingMock = searchGeocoding as jest.MockedFunction<typeof searchGeocoding>;
const trackMock = track as jest.Mock;

async function runSearch(field: "origin" | "destination") {
  const onSelected = jest.fn();
  const { result } = renderHook(() => useGeocodingSearch(field, onSelected));
  await act(async () => {
    await result.current.search("神田駅");
  });
  return onSelected;
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("records a found place search and selection by address", async () => {
  searchGeocodingMock.mockResolvedValue({
    status: "success",
    location: { lat: 35.69, lng: 139.75, address: "千代田区神田" },
  });

  const onSelected = await runSearch("destination");

  expect(trackMock).toHaveBeenCalledWith("place_search", { field: "destination", outcome: "found" });
  expect(trackMock).toHaveBeenCalledWith("place_select", { field: "destination", source: "address" });
  expect(onSelected).toHaveBeenCalledWith({ lat: 35.69, lng: 139.75, address: "千代田区神田" });
});

it("records an empty address search as not found", async () => {
  searchGeocodingMock.mockResolvedValue({ status: "empty", error: "見つかりません" });

  const onSelected = await runSearch("origin");

  expect(trackMock).toHaveBeenCalledWith("place_search", { field: "origin", outcome: "not_found" });
  expect(onSelected).not.toHaveBeenCalled();
});

it("records a failed address search", async () => {
  searchGeocodingMock.mockResolvedValue({ status: "error", error: "通信に失敗しました" });

  await runSearch("origin");

  expect(trackMock).toHaveBeenCalledWith("place_search", { field: "origin", outcome: "failed" });
});

it("records a rate-limited address search", async () => {
  searchGeocodingMock.mockResolvedValue({ status: "rate-limited", isRateLimited: true });

  await runSearch("destination");

  expect(trackMock).toHaveBeenCalledWith("place_search", { field: "destination", outcome: "rate_limited" });
});
