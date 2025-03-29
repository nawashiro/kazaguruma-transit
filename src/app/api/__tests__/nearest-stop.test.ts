import { GET } from "../transit/nearest-stop/route";
import { NextRequest } from "next/server";
import * as gtfs from "gtfs";

// GTFSモジュールのモックデータ
const mockStops = [
  {
    stop_id: "1",
    stop_name: "Test Stop 1",
    stop_lat: 35.6812,
    stop_lon: 139.7671,
  },
  {
    stop_id: "2",
    stop_name: "Test Stop 2",
    stop_lat: 35.6895,
    stop_lon: 139.7004,
  },
];

// テスト開始前にモックを設定
beforeEach(() => {
  jest.clearAllMocks();
  (gtfs.getStops as jest.Mock).mockResolvedValue(mockStops);
  (gtfs.openDb as jest.Mock).mockResolvedValue(undefined);
  (gtfs.closeDb as jest.Mock).mockResolvedValue(undefined);
});

describe("Nearest Stop API", () => {
  describe("GET handler", () => {
    // 座標が指定されている場合のテスト
    it.skip("有効な座標が指定されている場合に最寄りのバス停を返すこと", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/transit/nearest-stop?lat=35.681236&lng=139.767125"
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("nearestStop");
      expect(data.nearestStop).toHaveProperty("stop_id", "1");
      expect(data.nearestStop).toHaveProperty("stop_name", "Test Stop 1");
      expect(data.nearestStop).toHaveProperty("distance");
    });

    // 座標が指定されていない場合のテスト
    it.skip("座標が指定されていない場合にエラーを返すこと", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/transit/nearest-stop"
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty("error");
    });

    // バス停が見つからない場合のテスト
    it.skip("バス停がデータベースにない場合にエラーを返すこと", async () => {
      (gtfs.getStops as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/transit/nearest-stop?lat=35.681236&lng=139.767125"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.nearestStop).toBeNull();
    });
  });
});
