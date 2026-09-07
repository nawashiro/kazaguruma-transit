/** @jest-environment node */

import { get } from "node:http";

const BASE_URL =
  process.env.LOCATION_PAGES_ORIGIN_BASE_URL ?? "http://127.0.0.1:3100";
const CATEGORY_PATH = "/locations/hospital";
const OUT_OF_AREA_ORIGIN = "51.5074,-0.1278";
const DISTANCE_MODE_TEXT = "距離の近い順で表示しています。";
const TOWN_MODE_TEXT = "町字ごとに表示しています。";

type HttpResponse = {
  statusCode: number;
  body: string;
};

/**
 * This is deliberately a real HTTP request, not a Jest/browser fetch mock.
 * Start an existing production Next server first, or set
 * LOCATION_PAGES_ORIGIN_BASE_URL to its URL.
 */
function requestHtml(pathname: string): Promise<HttpResponse> {
  const url = new URL(pathname, BASE_URL);

  return new Promise((resolve, reject) => {
    const request = get(
      url,
      {
        headers: {
          accept: "text/html",
        },
      },
      (response) => {
        const chunks: string[] = [];
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => chunks.push(chunk));
        response.once("aborted", () => {
          reject(new Error(`HTTP response aborted: ${url.href}`));
        });
        response.once("error", reject);
        response.once("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: chunks.join(""),
          });
        });
      },
    );

    request.setTimeout(15_000, () => {
      request.destroy(new Error(`HTTP request timed out: ${url.href}`));
    });
    request.once("error", reject);
  });
}

describe("runtime origin rendering for a known location category", () => {
  it("renders distance mode for a valid out-of-area origin query", async () => {
    const originQuery = encodeURIComponent(OUT_OF_AREA_ORIGIN);
    const response = await requestHtml(
      `${CATEGORY_PATH}?origin=${originQuery}`,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.includes(DISTANCE_MODE_TEXT)).toBe(true);
    expect(response.body.includes(TOWN_MODE_TEXT)).toBe(false);
  });
});
