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

  it("handles empty input and network failure", async () => {
    await expect(searchGeocoding("   ")).resolves.toMatchObject({ status: "error" });
    await expect(searchGeocoding("場所", () => Promise.reject(new Error("offline")))).resolves.toMatchObject({ status: "error", error: "offline" });
  });
});
