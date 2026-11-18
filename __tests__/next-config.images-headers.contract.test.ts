import nextConfig from "../next.config";

describe("next config derived image cache headers", () => {
  it("caches derived location images for a year but not the artifact JSON", async () => {
    const headers = nextConfig.headers;
    if (!headers) {
      throw new Error("headers() is not defined in next.config.ts");
    }

    const rules = await headers();
    const imageRule = rules.find(
      (rule) => rule.source === "/generated/location-images/:path*",
    );
    expect(imageRule?.headers).toContainEqual({
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    });

    for (const rule of rules) {
      const cacheControl = rule.headers.find(
        (header) => header.key.toLowerCase() === "cache-control",
      );
      if (!cacheControl) {
        continue;
      }
      expect(rule.source).not.toBe("/generated/location-data.json");
      expect(rule.source).not.toBe("/generated/:path*");
    }
  });
});
