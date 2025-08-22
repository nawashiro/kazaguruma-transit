import type { Event } from 'nostr-tools'
import type { PWKBlob } from 'nosskey-sdk'

export interface NostrProfile {
  name?: string
  about?: string
  picture?: string
  pubkey: string
}

export interface DiscussionModerator {
  pubkey: string
  name?: string
}

export interface Discussion {
  id: string
  dTag: string
  title: string
  description: string
  moderators: DiscussionModerator[]
  authorPubkey: string
  createdAt: number
  event: Event
  // spec_v2.md要件: 承認システム対応
  approvedAt?: number
  approvalReference?: string
}

export interface DiscussionPost {
  id: string
  content: string
  authorPubkey: string
  discussionId: string
  busStopTag?: string
  createdAt: number
  approved: boolean
  approvedBy?: string[]
  approvedAt?: number
  event: Event
}

export interface PostApproval {
  id: string
  postId: string
  postAuthorPubkey: string
  moderatorPubkey: string
  discussionId: string
  createdAt: number
  event: Event
}

export interface PostEvaluation {
  id: string
  postId: string
  evaluatorPubkey: string
  rating: '+' | '-'
  discussionId?: string
  createdAt: number
  event: Event
}

export interface DiscussionRequest {
  id: string
  title: string
  description: string
  requesterPubkey: string
  adminPubkey: string
  createdAt: number
  event: Event
}

export interface EvaluationStats {
  positive: number
  negative: number
  total: number
  score: number
}

export interface PostWithStats extends DiscussionPost {
  evaluationStats: EvaluationStats
}

export interface UserAuth {
  pwk: PWKBlob | null
  pubkey: string | null
  isLoggedIn: boolean
  profile: NostrProfile | null
}

export interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (pwk: PWKBlob) => void
}

export interface PostPreviewProps {
  content: string
  busStopTag?: string
  onConfirm: () => void
  onCancel: () => void
}

export interface EvaluationComponentProps {
  posts: PostWithStats[]
  onEvaluate: (postId: string, rating: '+' | '-') => Promise<void>
  userEvaluations: Set<string>
  isRandomOrder?: boolean
  maxDisplayCount?: number
}

export interface ModeratorCheckProps {
  children: React.ReactNode
  moderators: string[]
  userPubkey?: string | null
  fallback?: React.ReactNode
}

export interface AdminCheckProps {
  children: React.ReactNode
  adminPubkey: string
  userPubkey?: string | null
  fallback?: React.ReactNode
}

export interface AuditTimelineItem {
  id: string
  type: 'discussion-request' | 'discussion-created' | 'discussion-deleted' | 'post-submitted' | 'post-approved' | 'post-rejected'
  timestamp: number
  actorPubkey: string
  actorName?: string
  targetId?: string
  description: string
  event: Event
}

export interface BusStop {
  id: string
  name: string
  routeId?: string
}

export interface RouteInfo {
  id: string
  name: string
  stops: BusStop[]
}

export interface PostFormData {
  content: string
  busStopTag?: string
}

export interface DiscussionFormData {
  title: string
  description: string
  moderators: string[]
}

export interface DiscussionRequestFormData {
  title: string
  description: string
}

export interface NostrEventWithProfile extends Event {
  profile?: NostrProfile
}

export interface DiscussionConfig {
  adminPubkey: string
  moderators: DiscussionModerator[]
  busStopDiscussionId: string
  relays: {
    url: string
    read: boolean
    write: boolean
  }[]
}

export interface DiscussionStats {
  totalPosts: number
  approvedPosts: number
  pendingPosts: number
  totalEvaluations: number
}

export type TabType = 'main' | 'audit' | 'manage' | 'approve'

export interface TabConfig {
  id: TabType
  label: string
  href?: string
}

export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export interface LoadingState {
  isLoading: boolean
  error: string | null
}

export interface DiscussionError extends Error {
  code: 'RELAY_ERROR' | 'AUTH_ERROR' | 'VALIDATION_ERROR' | 'PERMISSION_ERROR'
  details?: Record<string, unknown>
}