/** @jest-environment node */

import { get } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

const BASE_URL =
  process.env.LOCATION_PAGES_DETAIL_BASE_URL ?? "http://127.0.0.1:3100";

type HttpResponse = {
  statusCode: number;
  body: string;
};

type ArtifactLocation = {
  id: string;
  name: string;
};

/**
 * This is deliberately a real HTTP request, not the Jest/browser fetch mock.
 * Start an existing production Next server first, or set
 * LOCATION_PAGES_DETAIL_BASE_URL to its URL.
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

function readKnownLocation(): ArtifactLocation {
  const artifactPath = path.join(
    process.cwd(),
    "public",
    "generated",
    "location-data.json",
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    sources?: { locations?: Array<{ locations?: ArtifactLocation[] }> };
  };
  const locations = (artifact.sources?.locations ?? []).flatMap(
    (category) => category.locations ?? [],
  );
  const location = locations.find(
    (candidate) =>
      typeof candidate.id === "string" &&
      typeof candidate.name === "string" &&
      candidate.name.length > 0 &&
      !/[&<>"']/u.test(candidate.name),
  );
  if (location === undefined) {
    throw new Error(
      "A usable location was not found in public/generated/location-data.json. Run npm run build first.",
    );
  }
  return location;
}

describe("runtime location detail resolution", () => {
  it("renders a known urn:uuid detail route when the segment is percent-encoded", async () => {
    const location = readKnownLocation();
    const pathname = `/locations/location-detail/${encodeURIComponent(location.id)}`;

    const response = await requestHtml(pathname);

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain(location.name);
    expect(response.body).toContain("バリアフリー情報");
  });
});
