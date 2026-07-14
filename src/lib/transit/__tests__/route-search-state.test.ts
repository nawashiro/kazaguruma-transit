import {
  createInitialRouteSearchState,
  reduceRouteSearchState,
  type RouteSearchResult,
} from "../route-search-state";

const result: RouteSearchResult = { routeInfo: { hasRoute: true } };

describe("route-search-state", () => {
  it("管理する検索状態を明示的に遷移させる", () => {
    const initial = createInitialRouteSearchState();
    const loading = reduceRouteSearchState(initial, {
      type: "start",
      requestId: 1,
    });

    expect(loading.status).toBe("loading");
    expect(
      reduceRouteSearchState(loading, {
        type: "success",
        requestId: 1,
        result,
      }).status,
    ).toBe("success");
    expect(
      reduceRouteSearchState(loading, {
        type: "empty",
        requestId: 1,
        message: "経路が見つかりませんでした",
      }).status,
    ).toBe("empty");
  });

  it("古い要求の結果を現在の状態へ適用しない", () => {
    const loading = reduceRouteSearchState(
      reduceRouteSearchState(createInitialRouteSearchState(), {
        type: "start",
        requestId: 1,
      }),
      { type: "start", requestId: 2 },
    );

    const current = reduceRouteSearchState(loading, {
      type: "success",
      requestId: 1,
      result,
    });

    expect(current).toEqual(loading);
  });

  it("リセットで入力結果を初期状態へ戻す", () => {
    const loading = reduceRouteSearchState(createInitialRouteSearchState(), {
      type: "start",
      requestId: 4,
    });

    expect(
      reduceRouteSearchState(loading, { type: "reset" }),
    ).toMatchObject({ status: "idle", requestId: 5 });
  });
});
