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

describe("入力中の候補表示", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderSuggestHook(field: "origin" | "destination" = "destination") {
    const onSelected = jest.fn();
    const view = renderHook(() => useGeocodingSearch(field, onSelected));
    return { onSelected, view };
  }

  it("入力を止めてから1回だけ検索し、候補を返す", async () => {
    searchGeocodingMock.mockResolvedValue({ status: "success", candidates: CANDIDATES });
    const { view } = renderSuggestHook();

    act(() => {
      view.result.current.setQuery("千代");
    });
    act(() => {
      view.result.current.setQuery("千代田");
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(searchGeocodingMock).toHaveBeenCalledTimes(1);
    expect(searchGeocodingMock).toHaveBeenCalledWith("千代田");
    expect(view.result.current.candidates).toEqual(CANDIDATES);
    expect(trackMock).not.toHaveBeenCalledWith("place_search", expect.anything());
  });

  it("2文字に満たない入力では検索しない", async () => {
    const { view } = renderSuggestHook();

    act(() => {
      view.result.current.setQuery("千");
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(searchGeocodingMock).not.toHaveBeenCalled();
    expect(view.result.current.candidates).toEqual([]);
  });

  it("文字を消すと候補を消し、検索もしない", async () => {
    searchGeocodingMock.mockResolvedValue({ status: "success", candidates: CANDIDATES });
    const { view } = renderSuggestHook();
    act(() => {
      view.result.current.setQuery("千代田");
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(view.result.current.candidates).toEqual(CANDIDATES);

    act(() => {
      view.result.current.setQuery("");
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(view.result.current.candidates).toEqual([]);
    expect(searchGeocodingMock).toHaveBeenCalledTimes(1);
  });

  it("変換中は検索せず、変換の確定後に1回だけ検索する", async () => {
    searchGeocodingMock.mockResolvedValue({ status: "success", candidates: CANDIDATES });
    const { view } = renderSuggestHook();

    act(() => {
      view.result.current.handleCompositionStart();
    });
    for (const draft of ["か", "かん", "かんだ"]) {
      act(() => {
        view.result.current.setQuery(draft);
      });
      act(() => {
        jest.advanceTimersByTime(250);
      });
    }
    expect(searchGeocodingMock).not.toHaveBeenCalled();

    await act(async () => {
      view.result.current.handleCompositionEnd();
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(searchGeocodingMock).toHaveBeenCalledTimes(1);
    expect(searchGeocodingMock).toHaveBeenCalledWith("かんだ");
  });

  it("先に始めた検索の応答が遅れても新しい候補を上書きしない", async () => {
    const slow: { resolve?: (result: Awaited<ReturnType<typeof searchGeocoding>>) => void } = {};
    const newer = [{ name: "神田駅", address: "千代田区鍛冶町二丁目6番", lat: 35.68, lng: 139.76, kind: "station" }];
    searchGeocodingMock.mockImplementationOnce(
      () => new Promise(resolve => {
        slow.resolve = result => resolve(result);
      }) as ReturnType<typeof searchGeocoding>,
    );
    searchGeocodingMock.mockResolvedValueOnce({ status: "success", candidates: CANDIDATES });
    const { view } = renderSuggestHook();

    act(() => {
      view.result.current.setQuery("神田");
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    act(() => {
      view.result.current.setQuery("神田駅");
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(view.result.current.candidates).toEqual(CANDIDATES);

    await act(async () => {
      slow.resolve?.({ status: "success", candidates: newer });
      await Promise.resolve();
    });

    expect(view.result.current.candidates).toEqual(CANDIDATES);
    expect(searchGeocodingMock).toHaveBeenCalledTimes(2);
  });

  it("打鍵中の空振りと失敗ではエラーを立てない", async () => {
    searchGeocodingMock.mockResolvedValueOnce({ status: "empty", candidates: [], error: "ありません" });
    const { view } = renderSuggestHook();

    act(() => {
      view.result.current.setQuery("きょ");
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(view.result.current.error).toBeNull();
    expect(view.result.current.candidates).toEqual([]);

    searchGeocodingMock.mockResolvedValueOnce({
      status: "error",
      candidates: [],
      error: "通信に失敗しました",
    });
    act(() => {
      view.result.current.setQuery("きょう");
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });

    expect(view.result.current.error).toBeNull();
  });

  it("入力欄を離れたときに候補なしをエラーとして示す", async () => {
    searchGeocodingMock.mockResolvedValueOnce({ status: "empty", candidates: [], error: "ありません" });
    const { view } = renderSuggestHook();

    act(() => {
      view.result.current.setQuery("きょう");
    });
    await act(async () => {
      view.result.current.handleBlur();
      await Promise.resolve();
    });

    expect(view.result.current.error).toBe("ありません");
  });

  it("Enterの検索は待ち時間を置かずに実行し、結果を記録する", async () => {
    searchGeocodingMock.mockResolvedValue({ status: "success", candidates: CANDIDATES });
    const { view } = renderSuggestHook();

    act(() => {
      view.result.current.setQuery("千代田");
    });
    await act(async () => {
      await view.result.current.search();
      await Promise.resolve();
    });

    expect(searchGeocodingMock).toHaveBeenCalledWith("千代田");
    expect(trackMock).toHaveBeenCalledWith("place_search", {
      field: "destination",
      outcome: "found",
    });
    expect(view.result.current.candidates).toEqual(CANDIDATES);
  });

  it("Escで表示中の候補を閉じる", async () => {
    searchGeocodingMock.mockResolvedValue({ status: "success", candidates: CANDIDATES });
    const { view } = renderSuggestHook();
    act(() => {
      view.result.current.setQuery("千代田");
    });
    await act(async () => {
      jest.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(view.result.current.candidates).toEqual(CANDIDATES);

    act(() => {
      view.result.current.handleEscape();
    });

    expect(view.result.current.candidates).toEqual([]);
    expect(view.result.current.query).toBe("千代田");
  });

  it("候補を選ぶと保留中の検索を取り消す", async () => {
    searchGeocodingMock.mockResolvedValue({ status: "success", candidates: CANDIDATES });
    const { onSelected, view } = renderSuggestHook();
    act(() => {
      view.result.current.setQuery("千代田");
    });
    act(() => {
      view.result.current.selectCandidate(CANDIDATES[0]);
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(searchGeocodingMock).not.toHaveBeenCalled();
    expect(onSelected).toHaveBeenCalledWith({
      lat: 35.694,
      lng: 139.753,
      address: "千代田区役所",
    });
  });
});

describe("Enterの後に重ねて検索しない", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("Enterで確定した同じ語では、後からデバウンスの検索を走らせない", async () => {
    searchGeocodingMock.mockResolvedValue({ status: "success", candidates: CANDIDATES });
    const { result } = renderHook(() => useGeocodingSearch("destination", jest.fn()));

    act(() => {
      result.current.setQuery("千代田");
    });
    await act(async () => {
      await result.current.search();
      await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(searchGeocodingMock).toHaveBeenCalledTimes(1);
  });
});

describe("確定の検索中に入力欄を離れる", () => {
  it("Enterの検索が終わる前にフォーカスを外しても、同じ語を二重に検索しない", async () => {
    let resolveSearch: ((value: Awaited<ReturnType<typeof searchGeocoding>>) => void) | undefined;
    searchGeocodingMock.mockImplementationOnce(
      () => new Promise(resolve => {
        resolveSearch = resolve as typeof resolveSearch;
      }) as ReturnType<typeof searchGeocoding>,
    );
    const { result } = renderHook(() => useGeocodingSearch("destination", jest.fn()));

    act(() => {
      result.current.setQuery("神田駅");
    });
    let pending: Promise<boolean> | undefined;
    act(() => {
      pending = result.current.search();
    });
    act(() => {
      result.current.handleBlur();
    });
    await act(async () => {
      resolveSearch?.({ status: "success", candidates: CANDIDATES });
      await pending;
    });

    expect(searchGeocodingMock).toHaveBeenCalledTimes(1);
  });
});
