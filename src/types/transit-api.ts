// すべての型定義は @/types/core に移動されました
// このファイルは統合されたコア型により非推奨となりました

/**
 * @deprecated - すべての型定義は @/types/core に移動されました
 * 代わりに @/types/core からインポートしてください:
 * - TransitQuery, RouteQuery, StopQuery, TimetableQuery
 * - TransitResponse, RouteResponse, StopResponse, TimetableResponse  
 * - Journey, RouteSegment, TransferInfo, NearbyStop
 * - StopInfo, TimetableEntry
 */

// 移行期間中の後方互換性のためにコア型を再エクスポート
export type {
  TransitQuery,
  RouteQuery,
  StopQuery,
  TimetableQuery,
  TransitResponse,
  RouteResponse,
  StopResponse,
  TimetableResponse,
  Journey,
  RouteSegment,
  TransferInfo,
  NearbyStop,
  StopInfo,
  TimetableEntry
} from "@/types/core";
