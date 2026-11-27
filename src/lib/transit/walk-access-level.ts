import { TRANSIT_PARAMS } from "./transit-params";

/** 徒歩距離の段階。警告線以下は通常、上限以下は遠い、それを超えると遠すぎる。 */
export type WalkAccessLevel = "near" | "far" | "tooFar";

/**
 * 画面とAPIが同じ判定を使うための関数。徒歩ネットワークを読む重い処理は
 * 持たないため、クライアントからも読み込める。
 */
export function walkAccessLevel(meters: number): WalkAccessLevel {
  if (meters <= TRANSIT_PARAMS.WARN_WALK_TO_STOP_METERS) {
    return "near";
  }
  if (meters <= TRANSIT_PARAMS.MAX_WALK_TO_STOP_METERS) {
    return "far";
  }
  return "tooFar";
}

/** 徒歩距離に応じた警告の文言。通常の距離には警告しない。 */
export const WALK_WARNING_LABEL: Record<WalkAccessLevel, string | null> = {
  near: null,
  far: "バス停から遠い",
  tooFar: "バス停から遠すぎ",
};
