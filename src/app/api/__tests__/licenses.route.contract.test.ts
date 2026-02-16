import { describe, expect, it, jest } from "@jest/globals";
import { GET } from "../licenses/route";

jest.mock("@/lib/license/licensePayload", () => ({
  getLicensePagePayload: jest.fn(async () => ({
    software: {
      name: "kazaguruma-transit",
      version: "0.1.0",
      license: "UNLICENSED",
      author: "Nawashiro",
    },
    openData: [],
    dependencies: [],
    generatedAt: "2026-02-16T00:00:00.000Z",
  })),
}));

describe("GET /api/licenses contract", () => {
  it("returns contract-compatible payload", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("software");
    expect(data).toHaveProperty("openData");
    expect(data).toHaveProperty("dependencies");
    expect(data).toHaveProperty("generatedAt");
    expect(data.software).toHaveProperty("name");
    expect(data.software).toHaveProperty("version");
    expect(data.software).toHaveProperty("license");
    expect(data.software).toHaveProperty("author");
  });
});
