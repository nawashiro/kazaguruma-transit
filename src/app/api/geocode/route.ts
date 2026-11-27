import { NextRequest, NextResponse } from "next/server";
import path from "node:path";

import { logger } from "../../../utils/logger";
import { loadGeocodeIndex } from "../../../lib/location/geocode-index";
import { GeocodeSearcher } from "../../../lib/location/geocode-search";

const GEOCODE_INDEX_PATH = path.join(process.cwd(), "data", "geocode-index.json");

interface GeocodeCandidateResponse {
  name: string;
  address: string;
  lat: number;
  lng: number;
  kind: string;
}

interface GeocodeSearchResponse {
  success: true;
  results: GeocodeCandidateResponse[];
}

interface GeocodeReverseResponse {
  success: true;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
}

interface GeocodeErrorResponse {
  success: false;
  error: string;
}

let cachedSearcher: GeocodeSearcher | null = null;

/**
 * 索引は1.3MBあり、要求のたびに読み直す必要はない。開発時は索引を
 * 更新したら再起動する前提で、プロセス内に1度だけ読み込む。
 */
function getSearcher(): GeocodeSearcher | null {
  if (cachedSearcher !== null) {
    return cachedSearcher;
  }
  const loaded: ReturnType<typeof loadGeocodeIndex> = loadGeocodeIndex(
    GEOCODE_INDEX_PATH,
  );
  if (loaded.status !== "success") {
    logger.error("地点索引を読み込めません:", loaded.error.message);
    return null;
  }
  cachedSearcher = new GeocodeSearcher(loaded.index);
  return cachedSearcher;
}

function errorResponse(error: string, status: number) {
  const body: GeocodeErrorResponse = { success: false, error };
  return NextResponse.json(body, { status });
}

function readCoordinate(value: string | null): number | null {
  if (value === null || value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.has("address")) {
      return errorResponse(
        "address パラメーターは廃止しました。q か lat/lng を使ってください",
        400,
      );
    }

    const searcher = getSearcher();
    if (searcher === null) {
      return errorResponse("地点索引を読み込めませんでした", 500);
    }

    const rawLat = searchParams.get("lat");
    const rawLng = searchParams.get("lng");
    if (rawLat !== null || rawLng !== null) {
      const lat = readCoordinate(rawLat);
      const lng = readCoordinate(rawLng);
      if (lat === null || lng === null) {
        return errorResponse("lat と lng には数値を指定してください", 400);
      }
      const address = searcher.reverse(lat, lng);
      if (address === null) {
        return errorResponse(
          "指定された座標の住所は見つかりませんでした",
          404,
        );
      }
      const body: GeocodeReverseResponse = {
        success: true,
        location: { lat, lng, address },
      };
      return NextResponse.json(body);
    }

    const query = searchParams.get("q");
    if (query === null || query.trim().length === 0) {
      return errorResponse("q パラメーターが必要です", 400);
    }

    const results = searcher.search(query);
    if (results.length === 0) {
      const body: GeocodeSearchResponse = { success: true, results: [] };
      return NextResponse.json(body);
    }
    const body: GeocodeSearchResponse = {
      success: true,
      results: results.map((candidate) => ({
        name: candidate.name,
        address: candidate.address,
        lat: candidate.lat,
        lng: candidate.lng,
        kind: candidate.kind,
      })),
    };
    return NextResponse.json(body);
  } catch (error) {
    logger.error("地点検索エラー:", error);
    return errorResponse("地点検索処理中にエラーが発生しました", 500);
  }
}
