import {
  candidateToLocation,
  normalizeSearchAddress,
  reverseGeocoding,
  searchGeocoding,
  type GeocodeCandidate,
} from "../geocoding-search";

const CANDIDATE: GeocodeCandidate = {
  name: "千代田区役所",
  address: "千代田区九段南一丁目2番",
  lat: 35.6941626,
  lng: 139.7535624,
  kind: "public",
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("searchGeocoding", () => {
  it("候補配列を返す", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse(200, { success: true, results: [CANDIDATE] }),
    ) as unknown as typeof fetch;
    const result = await searchGeocoding("千代田区役所", fetcher);
    expect(result.status).toBe("success");
    expect(result.candidates).toEqual([CANDIDATE]);
  });

  it("q パラメーターで問い合わせる", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse(200, { success: true, results: [] }),
    ) as unknown as typeof fetch;
    await searchGeocoding("  千代田区役所  ", fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      `/api/geocode?q=${encodeURIComponent("千代田区役所")}`,
    );
  });

  it("空の候補を not found として扱う", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse(200, { success: true, results: [] }),
    ) as unknown as typeof fetch;
    const result = await searchGeocoding("あああ", fetcher);
    expect(result.status).toBe("empty");
    expect(result.error).toMatch(/見つかりません/);
  });

  it("失敗した応答は429でもエラーとして扱う", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse(429, { success: false, error: "混雑しています" }),
    ) as unknown as typeof fetch;
    const result = await searchGeocoding("千代田区役所", fetcher);
    expect(result).toEqual({
      candidates: [],
      status: "error",
      error: "混雑しています",
    });
  });

  it("サーバーのエラーをそのまま伝える", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse(500, { success: false, error: "索引が壊れています" }),
    ) as unknown as typeof fetch;
    const result = await searchGeocoding("千代田区役所", fetcher);
    expect(result.status).toBe("error");
    expect(result.error).toBe("索引が壊れています");
  });

  it("空の検索語は問い合わせない", async () => {
    const fetcher = jest.fn() as unknown as typeof fetch;
    const result = await searchGeocoding("   ", fetcher);
    expect(result.status).toBe("error");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("通信の失敗をエラーにする", async () => {
    const fetcher = jest.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const result = await searchGeocoding("千代田区役所", fetcher);
    expect(result.status).toBe("error");
    expect(result.error).toBe("offline");
  });
});

describe("reverseGeocoding", () => {
  it("住所を返す", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse(200, {
        success: true,
        location: { lat: 35.69, lng: 139.75, address: "千代田区九段南一丁目2番" },
      }),
    ) as unknown as typeof fetch;
    const result = await reverseGeocoding(35.69, 139.75, fetcher);
    expect(result.status).toBe("success");
    expect(result.location?.address).toBe("千代田区九段南一丁目2番");
  });

  it("区外の座標を住所なしとして扱う", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse(404, { success: false, error: "見つかりません" }),
    ) as unknown as typeof fetch;
    const result = await reverseGeocoding(35.5, 139.5, fetcher);
    expect(result.status).toBe("empty");
    expect(result.location).toBeUndefined();
  });

  it("数値でない座標は問い合わせない", async () => {
    const fetcher = jest.fn() as unknown as typeof fetch;
    const result = await reverseGeocoding(Number.NaN, 139.75, fetcher);
    expect(result.status).toBe("error");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("candidateToLocation / normalizeSearchAddress", () => {
  it("候補の名前を表示用の住所として使う", () => {
    expect(candidateToLocation(CANDIDATE)).toEqual({
      lat: CANDIDATE.lat,
      lng: CANDIDATE.lng,
      address: "千代田区役所",
    });
  });

  it("検索語の前後の空白だけを落とす", () => {
    expect(normalizeSearchAddress(" 千代田区 神田 ")).toBe("千代田区 神田");
  });

  it("候補の徒歩距離があれば地点へ引き継ぐ", () => {
    const location = candidateToLocation({
      name: "科学技術館",
      address: "千代田区北の丸公園2-1",
      lat: 35.6915,
      lng: 139.7531,
      kind: "culture",
      walkMeters: 537,
    });

    expect(location.walkMeters).toBe(537);
  });

  it("候補の徒歩距離がなければ欄を作らない", () => {
    const location = candidateToLocation({
      name: "科学技術館",
      address: "千代田区北の丸公園2-1",
      lat: 35.6915,
      lng: 139.7531,
      kind: "culture",
    });

    expect(location).not.toHaveProperty("walkMeters");
  });

  it("逆引きの徒歩距離を受け取る", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        location: {
          lat: 35.6915,
          lng: 139.7531,
          address: "千代田区北の丸公園",
          walkMeters: 720,
        },
      }),
    });

    const result = await reverseGeocoding(35.6915, 139.7531, fetcher as unknown as typeof fetch);

    expect(result.location?.walkMeters).toBe(720);
  });

  it("逆引きの徒歩距離がなければ欄を作らない", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        location: { lat: 35.6915, lng: 139.7531, address: "千代田区北の丸公園" },
      }),
    });

    const result = await reverseGeocoding(35.6915, 139.7531, fetcher as unknown as typeof fetch);

    expect(result.location).not.toHaveProperty("walkMeters");
  });
});
