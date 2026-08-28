import { normalizeSearchAddress, searchGeocoding } from "../geocoding-search";

const response = (body: unknown, init?: ResponseInit) => Promise.resolve(new Response(JSON.stringify(body), init));

describe("geocoding-search", () => {
  it("normalizes the Chiyoda-ku prefix and handles success", async () => {
    expect(normalizeSearchAddress("神田駅")).toBe("千代田区 神田駅");
    await expect(searchGeocoding("神田駅", () => response({ success: true, results: [{ lat: 1, lng: 2, formattedAddress: "東京都" }] }))).resolves.toEqual({ status: "success", location: { lat: 1, lng: 2, address: "東京都" } });
  });

  it.each([
    [{ success: true, results: [] }, undefined, "empty"],
    [{ limitExceeded: true }, { status: 429 }, "rate-limited"],
    [{ error: "bad" }, { status: 500 }, "error"],
  ])("returns a shared status for response failures", async (body, init, status) => {
    await expect(searchGeocoding("場所", () => response(body, init))).resolves.toMatchObject({ status });
  });

  it("429 + limitExceeded returns an explicit rate-limited result without retrying", async () => {
    const fetcher = jest.fn(() =>
      response({ limitExceeded: true }, { status: 429 }),
    );

    await expect(searchGeocoding("場所", fetcher)).resolves.toEqual({
      status: "rate-limited",
      isRateLimited: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("ordinary errors and success are not marked rate-limited", async () => {
    const error = await searchGeocoding("場所", () =>
      response({ error: "bad" }, { status: 500 }),
    );
    expect(error).toMatchObject({ status: "error" });
    expect(error.isRateLimited).not.toBe(true);
    const success = await searchGeocoding("場所", () =>
      response({
        success: true,
        results: [{ lat: 1, lng: 2, formattedAddress: "東京都" }],
      }),
    );
    expect(success).toMatchObject({ status: "success" });
    expect(success.isRateLimited).not.toBe(true);
  });

  it("handles empty input and network failure", async () => {
    await expect(searchGeocoding("   ")).resolves.toMatchObject({ status: "error" });
    await expect(searchGeocoding("場所", () => Promise.reject(new Error("offline")))).resolves.toMatchObject({ status: "error", error: "offline" });
  });
});
