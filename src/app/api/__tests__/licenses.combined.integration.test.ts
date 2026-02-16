import { describe, expect, it } from "@jest/globals";
import { GET } from "../licenses/route";

describe("GET /api/licenses combined payload", () => {
  it("contains openData and dependencies in one payload", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.openData)).toBe(true);
    expect(Array.isArray(data.dependencies)).toBe(true);
    expect(data.openData[0]).toHaveProperty("licenseName");
    if (data.dependencies.length > 0) {
      expect(data.dependencies[0]).toHaveProperty("packageName");
    }
  });
});
