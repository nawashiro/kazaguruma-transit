import { act, renderHook } from "@testing-library/react";
import { searchGeocoding, type GeocodeCandidate } from "@/lib/location/geocoding-search";
import { track } from "@/lib/analytics/tracking";
import { useGeocodingSearch } from "../useGeocodingSearch";

jest.mock("@/lib/analytics/tracking", () => ({ track: jest.fn() }));
jest.mock("@/lib/location/geocoding-search", () => ({
  searchGeocoding: jest.fn(),
  candidateToLocation: (candidate: GeocodeCandidate) => ({
    lat: candidate.lat,
    lng: candidate.lng,
    address: candidate.name,
  }),
}));
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));

const searchGeocodingMock = searchGeocoding as jest.MockedFunction<typeof searchGeocoding>;
const trackMock = track as jest.Mock;

const CANDIDATES: GeocodeCandidate[] = [
  { name: "千代田区役所", address: "千代田区九段南一丁目2番", lat: 35.694, lng: 139.753, kind: "public" },
];

async function runSearch(field: "origin" | "destination") {
  const onSelected = jest.fn();
  const { result } = renderHook(() => useGeocodingSearch(field, onSelected));
  await act(async () => {
    await result.current.search("千代田区役所");
  });
  return { onSelected, result };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("候補を受け取り、検索だけでは地点を確定しない", async () => {
  searchGeocodingMock.mockResolvedValue({
    status: "success",
    candidates: CANDIDATES,
  });

  const { onSelected, result } = await runSearch("destination");

  expect(trackMock).toHaveBeenCalledWith("place_search", {
    field: "destination",
    outcome: "found",
  });
  expect(result.current.candidates).toEqual(CANDIDATES);
  expect(onSelected).not.toHaveBeenCalled();
});

it("選んだ候補だけを確定し、選択を記録する", async () => {
  searchGeocodingMock.mockResolvedValue({
    status: "success",
    candidates: CANDIDATES,
  });

  const { onSelected, result } = await runSearch("destination");

  act(() => {
    result.current.selectCandidate(CANDIDATES[0]);
  });

  expect(trackMock).toHaveBeenCalledWith("place_select", {
    field: "destination",
    source: "address",
  });
  expect(onSelected).toHaveBeenCalledWith({
    lat: 35.694,
    lng: 139.753,
    address: "千代田区役所",
  });
  expect(result.current.candidates).toEqual([]);
});

it("候補が無い検索を not found として記録する", async () => {
  searchGeocodingMock.mockResolvedValue({
    status: "empty",
    candidates: [],
    error: "見つかりません",
  });

  const { onSelected, result } = await runSearch("origin");

  expect(trackMock).toHaveBeenCalledWith("place_search", {
    field: "origin",
    outcome: "not_found",
  });
  expect(result.current.error).toBe("見つかりません");
  expect(onSelected).not.toHaveBeenCalled();
});

it("失敗した検索を failed として記録する", async () => {
  searchGeocodingMock.mockResolvedValue({
    status: "error",
    candidates: [],
    error: "通信に失敗しました",
  });

  await runSearch("origin");

  expect(trackMock).toHaveBeenCalledWith("place_search", {
    field: "origin",
    outcome: "failed",
  });
});

it("利用制限では利用制限画面へ案内する", async () => {
  searchGeocodingMock.mockResolvedValue({
    status: "rate-limited",
    candidates: [],
    isRateLimited: true,
  });

  await runSearch("destination");

  expect(trackMock).toHaveBeenCalledWith("place_search", {
    field: "destination",
    outcome: "rate_limited",
  });
  expect(mockPush).toHaveBeenCalledWith("/rate-limit?source=home");
});
