/** @jest-environment node */

import { get } from "node:http";

const BASE_URL =
  process.env.LOCATION_PAGES_404_BASE_URL ?? "http://127.0.0.1:3100";
const STANDARD_NOT_FOUND_TEXT = "404: This page could not be found.";
const KNOWN_CATEGORY_PATH = "/locations/hospital";

type HttpResponse = {
  statusCode: number;
  body: string;
};

const unknownLocationPageCases = [
  ["unknown category", "/locations/does-not-exist"],
  ["unknown detail", "/locations/location-detail/does-not-exist"],
] as const;

/**
 * This is deliberately a real HTTP request, not the Jest/browser fetch mock.
 * Start a production Next server first, or set LOCATION_PAGES_404_BASE_URL.
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

function stripExecutableHtml(body: string): string {
  return body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

describe("runtime standard 404 boundary for location pages", () => {
  it.each(unknownLocationPageCases)(
    "%s returns HTTP 404 with the standard not-found body",
    async (_caseName, pathname) => {
      const response = await requestHtml(pathname);

      expect(response.statusCode).toBe(404);
      expect(response.body).toContain(STANDARD_NOT_FOUND_TEXT);
    },
  );
});

describe("runtime server-rendered location page boundary (T045 RED)", () => {
  it("renders native navigation and both sort controls before page content without hydration", async () => {
    const response = await requestHtml(KNOWN_CATEGORY_PATH);

    expect(response.statusCode).toBe(200);
    const visibleHtml = stripExecutableHtml(response.body);

    const mainStart = visibleHtml.indexOf('<main id="main-content"');
    expect(mainStart).toBeGreaterThanOrEqual(0);
    const mainEnd = visibleHtml.indexOf("</main>", mainStart);
    expect(mainEnd).toBeGreaterThan(mainStart);
    const mainHtml = visibleHtml.slice(mainStart, mainEnd);

    const navStart = mainHtml.indexOf("<nav");
    expect(navStart).toBeGreaterThanOrEqual(0);
    const navEnd = mainHtml.indexOf("</nav>", navStart);
    expect(navEnd).toBeGreaterThan(navStart);

    const navigationHtml = mainHtml.slice(navStart, navEnd);
    expect(navigationHtml).toContain('aria-label="場所カテゴリ"');
    expect(navigationHtml).toContain("<a");
    expect(navigationHtml).toContain('href="/locations/');

    const townTextStart = mainHtml.indexOf("町字で並べる", navEnd);
    expect(townTextStart).toBeGreaterThan(navEnd);
    const townLinkStart = mainHtml.lastIndexOf("<a", townTextStart);
    expect(townLinkStart).toBeGreaterThan(navEnd);
    expect(mainHtml.indexOf("</a>", townTextStart)).toBeGreaterThan(
      townTextStart,
    );

    const distanceTextStart = mainHtml.indexOf(
      "近い順に並べる",
      townTextStart,
    );
    expect(distanceTextStart).toBeGreaterThan(townTextStart);
    const distanceButtonStart = mainHtml.lastIndexOf(
      "<button",
      distanceTextStart,
    );
    expect(distanceButtonStart).toBeGreaterThan(townTextStart);
    expect(mainHtml.indexOf("</button>", distanceTextStart)).toBeGreaterThan(
      distanceTextStart,
    );

    const childHeadingStart = mainHtml.indexOf("<h1", distanceTextStart);
    expect(childHeadingStart).toBeGreaterThan(distanceTextStart);
  });
});
