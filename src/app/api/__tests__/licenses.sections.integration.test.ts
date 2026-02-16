import { describe, expect, it } from "@jest/globals";
import { GET } from "../licenses/route";

describe("GET /api/licenses section mapping", () => {
  it("returns software/openData/dependencies by section", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(typeof data.software.name).toBe("string");
    expect(Array.isArray(data.openData)).toBe(true);
    expect(Array.isArray(data.dependencies)).toBe(true);
    expect(data.openData.length).toBeGreaterThan(0);
  });
});
