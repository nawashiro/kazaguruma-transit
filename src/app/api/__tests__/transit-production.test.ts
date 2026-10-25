/** @jest-environment node */

import { request } from "node:http";

const baseUrl = process.env.TRANSIT_API_BASE_URL ?? "http://127.0.0.1:3100";

function query(method: string, pathname: string, body?: object): Promise<{
  status: number;
  body: { success: boolean; data?: { stops?: unknown[] } };
}> {
  return new Promise((resolve, reject) => {
    const outgoing = request(new URL(pathname, baseUrl), {
      method,
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "192.0.2.25",
      },
    }, (response) => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { data += chunk; });
      response.once("error", reject);
      response.once("end", () => {
        try {
          resolve({ status: response.statusCode ?? 0, body: JSON.parse(data) });
        } catch (error) { reject(error); }
      });
    });
    outgoing.once("error", reject);
    outgoing.setTimeout(15_000, () => outgoing.destroy(new Error("Transit API timed out")));
    outgoing.end(body ? JSON.stringify(body) : undefined);
  });
}

it("reads stops through the production server and its rate limit database", async () => {
  const response = await query("POST", "/api/transit", {
    type: "stop", location: { lat: 12.345, lng: 45.678 }, radius: 1,
  });
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(Array.isArray(response.body.data?.stops)).toBe(true);
});

it("rejects incomplete route input after checking the rate limit", async () => {
  const response = await query("GET", "/api/transit?type=route");
  expect(response.status).toBe(400);
  expect(response.body.success).toBe(false);
});
