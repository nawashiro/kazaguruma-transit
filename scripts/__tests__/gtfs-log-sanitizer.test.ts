import {
  redactSensitiveUrlQueryParameters,
  sanitizeGtfsLogError,
} from "../gtfs-log-sanitizer";

describe("redactSensitiveUrlQueryParameters", () => {
  it("redacts credential-like URL parameters without hiding operational parameters", () => {
    const message =
      "Downloading https://example.com/feed.zip?date=20260716&acl%3AconsumerKey=top-secret";

    const sanitizedMessage = redactSensitiveUrlQueryParameters(message);

    expect(sanitizedMessage).toContain("date=20260716");
    expect(sanitizedMessage).toContain("acl%3AconsumerKey=REDACTED");
    expect(sanitizedMessage).not.toContain("top-secret");
  });

  it("redacts common token and signature parameter names case-insensitively", () => {
    const message =
      "URLs: https://example.com/a?access_token=token-value https://example.com/b?X-Signature=signature-value";

    const sanitizedMessage = redactSensitiveUrlQueryParameters(message);

    expect(sanitizedMessage).not.toContain("token-value");
    expect(sanitizedMessage).not.toContain("signature-value");
    expect(sanitizedMessage.match(/REDACTED/g)).toHaveLength(2);
  });

  it("leaves non-URL log messages unchanged", () => {
    const message = "GTFS import completed for one agency";

    expect(redactSensitiveUrlQueryParameters(message)).toBe(message);
  });
});

describe("sanitizeGtfsLogError", () => {
  it("redacts credentials from error stacks", () => {
    const error = new Error(
      "Download failed: https://example.com/feed.zip?api_key=top-secret",
    );

    const sanitizedError = sanitizeGtfsLogError(error);

    expect(sanitizedError).toContain("api_key=REDACTED");
    expect(sanitizedError).not.toContain("top-secret");
  });
});
