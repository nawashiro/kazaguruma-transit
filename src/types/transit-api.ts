// All types have been moved to @/types/core
// This file can be deprecated in favor of the consolidated core types

/**
 * @deprecated - All types have been moved to @/types/core
 * Import from @/types/core instead:
 * - TransitQuery, RouteQuery, StopQuery, TimetableQuery
 * - TransitResponse, RouteResponse, StopResponse, TimetableResponse  
 * - Journey, RouteSegment, TransferInfo, NearbyStop
 * - StopInfo, TimetableEntry
 */

// Re-export core types for backward compatibility during transition
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
