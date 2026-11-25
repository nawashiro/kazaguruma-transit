jest.mock("server-only", () => ({}), { virtual: true });

jest.mock("../../db/prisma", () => ({
  prisma: { stop: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) } },
}));

jest.mock("../walk-network", () => {
  const actual = jest.requireActual("../walk-network");
  return {
    ...actual,
    getWalkNetwork: () => {
      throw new Error("徒歩ネットワークを読み込めません: ENOENT");
    },
  };
});

import { TransitService } from "../transit-service";
import { prisma } from "../../db/prisma";

const findManyMock = prisma.stop.findMany as unknown as jest.Mock;

const query = {
  type: "route" as const,
  origin: { lat: 35.69, lng: 139.75 },
  destination: { lat: 35.685, lng: 139.748 },
  time: "2026-11-01T10:00",
  isDeparture: true,
};

describe("徒歩ネットワークを読めないとき", () => {
  beforeEach(() => {
    findManyMock.mockResolvedValue([]);
  });

  it("経路検索は失敗を返し、直線距離で経路を返さない", async () => {
    const service = TransitService.getInstance();
    const response = await service.process(query);

    expect(response.success).toBe(false);
    expect(response.error).toContain("徒歩ネットワークを読み込めません");
    expect(response.data).toEqual({ journeys: [], stops: [] });
  });
});
