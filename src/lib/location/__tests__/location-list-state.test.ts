import {
  calculateDistance,
  createInitialLocationListState,
  geocodeAddress,
  reduceLocationListState,
  sortLocationsByDistance,
} from "../location-list-state";

describe("location-list-state", () => {
  it("カテゴリデータと位置処理の状態を分離して扱う", () => {
    const initial = createInitialLocationListState();
    const loading = reduceLocationListState(initial, {
      type: "start",
      requestId: 1,
      operation: "categories",
    });

    expect(loading.status).toBe("loading");
    expect(
      reduceLocationListState(loading, {
        type: "categories-ready",
        requestId: 1,
        categories: [{ category: "病院", "category:en": "hospital", locations: [] }],
      }),
    ).toMatchObject({ status: "ready", activeCategory: "病院" });
  });

  it("古い位置・詳細要求の結果を適用しない", () => {
    const loading = reduceLocationListState(
      reduceLocationListState(createInitialLocationListState(), {
        type: "start",
        requestId: 1,
        operation: "position",
      }),
      { type: "start", requestId: 2, operation: "position" },
    );

    expect(
      reduceLocationListState(loading, {
        type: "position-ready",
        requestId: 1,
        position: { lat: 35.68, lng: 139.76 },
      }),
    ).toEqual(loading);
  });

  it("位置情報や詳細取得の失敗を状態として表す", () => {
    const loading = reduceLocationListState(createInitialLocationListState(), {
      type: "start",
      requestId: 1,
      operation: "detail",
    });

    expect(
      reduceLocationListState(loading, {
        type: "error",
        requestId: 1,
        message: "詳細情報を取得できませんでした",
      }),
    ).toMatchObject({ status: "error", error: "詳細情報を取得できませんでした" });
  });

  it("距離計算と距離順を共通処理として提供する", () => {
    expect(calculateDistance(35.68, 139.76, 35.69, 139.77)).toBeGreaterThan(0);
    expect(
      sortLocationsByDistance([
        { name: "遠い", lat: 0, lng: 0, distance: 2 },
        { name: "近い", lat: 0, lng: 0, distance: 1 },
      ])[0].name,
    ).toBe("近い");
  });

  it("住所検索の空入力・成功・429を共通状態へ変換する", async () => {
    await expect(geocodeAddress(" ")).resolves.toEqual({
      status: "error",
      message: "住所を入力してください",
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, results: [{ lat: 35.68, lng: 139.76 }] }),
    });
    await expect(geocodeAddress("神田")).resolves.toEqual({
      status: "success",
      position: { lat: 35.68, lng: 139.76 },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ limitExceeded: true }),
    });
    await expect(geocodeAddress("神田")).resolves.toMatchObject({ status: "rate-limited" });
  });
});
