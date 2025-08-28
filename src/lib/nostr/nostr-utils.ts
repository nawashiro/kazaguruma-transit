import type { Event } from "nostr-tools";
import * as nip19 from "nostr-tools/nip19";
import type {
  Discussion,
  DiscussionPost,
  PostApproval,
  PostEvaluation,
  DiscussionRequest,
  NostrProfile,
  EvaluationStats,
  PostWithStats,
  AuditTimelineItem,
} from "@/types/discussion";
import { logger } from "@/utils/logger";

export function parseDiscussionEvent(event: Event): Discussion | null {
  if (event.kind !== 34550) return null;

  const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
  const name = event.tags.find((tag) => tag[0] === "name")?.[1];
  const description = event.tags.find((tag) => tag[0] === "description")?.[1];

  if (!dTag) return null;

  const moderators = event.tags
    .filter((tag) => tag[0] === "p" && tag[3] === "moderator")
    .map((tag) => ({
      pubkey: tag[1],
      name: undefined,
    }));

  return {
    id: `34550:${event.pubkey}:${dTag}`,
    dTag,
    title: name || dTag,
    description: description || event.content,
    moderators,
    authorPubkey: event.pubkey,
    createdAt: event.created_at,
    event,
  };
}

export function parsePostEvent(
  event: Event,
  approvals: PostApproval[] = []
): DiscussionPost | null {
  // NIP-72後方互換性: kind:1とkind:1111の両方をサポート
  if (event.kind !== 1111 && event.kind !== 1) return null;

  const discussionTag = event.tags.find(
    (tag) => tag[0] === "a" || tag[0] === "A"
  )?.[1];
  const busStopTag = event.tags.find((tag) => tag[0] === "t")?.[1];

  if (!discussionTag) return null;

  const postApprovals = approvals.filter(
    (approval) => approval.postId === event.id
  );
  const approved = postApprovals.length > 0;
  const approvedBy = postApprovals.map((approval) => approval.moderatorPubkey);
  const approvedAt =
    postApprovals.length > 0
      ? Math.min(...postApprovals.map((a) => a.createdAt))
      : undefined;

  return {
    id: event.id,
    content: event.content,
    authorPubkey: event.pubkey,
    discussionId: discussionTag,
    busStopTag,
    createdAt: event.created_at,
    approved,
    approvedBy,
    approvedAt,
    event,
  };
}

export function parseApprovalEvent(event: Event): PostApproval | null {
  if (event.kind !== 4550) return null;

  const discussionTag = event.tags.find((tag) => tag[0] === "a")?.[1];
  const postId = event.tags.find((tag) => tag[0] === "e")?.[1];
  const postAuthorPubkey = event.tags.find((tag) => tag[0] === "p")?.[1];

  if (!discussionTag || !postId || !postAuthorPubkey) return null;

  return {
    id: event.id,
    postId,
    postAuthorPubkey,
    moderatorPubkey: event.pubkey,
    discussionId: discussionTag,
    createdAt: event.created_at,
    event,
  };
}

export function parseEvaluationEvent(event: Event): PostEvaluation | null {
  if (event.kind !== 7) return null;

  const postId = event.tags.find((tag) => tag[0] === "e")?.[1];
  const discussionId = event.tags.find((tag) => tag[0] === "a")?.[1];

  if (!postId) return null;

  // NIP-25: contentから評価を取得（ratingタグは使用しない）
  const rawRating = event.content?.trim();
  if (!rawRating) return null;

  // "-" 以外は全て "+" として扱う
  const rating = rawRating === "-" ? "-" : "+";

  return {
    id: event.id,
    postId,
    evaluatorPubkey: event.pubkey,
    rating,
    discussionId,
    createdAt: event.created_at,
    event,
  };
}

export function parseDiscussionRequestEvent(
  event: Event
): DiscussionRequest | null {
  if (event.kind !== 1) return null;

  const hasDiscussionRequestTag = event.tags.some(
    (tag) => tag[0] === "t" && tag[1] === "discussion-request"
  );
  const adminPubkey = event.tags.find((tag) => tag[0] === "p")?.[1];

  if (!hasDiscussionRequestTag || !adminPubkey) return null;

  // NIP-14に従ってsubjectタグからタイトルを取得
  const title = event.tags.find((tag) => tag[0] === "subject")?.[1] || "";

  const description = event.content;

  return {
    id: event.id,
    title,
    description,
    requesterPubkey: event.pubkey,
    adminPubkey,
    createdAt: event.created_at,
    event,
  };
}

export function parseProfileEvent(event: Event): NostrProfile | null {
  if (event.kind !== 0) return null;

  try {
    const content = JSON.parse(event.content);
    return {
      name: content.name,
      about: content.about,
      picture: content.picture,
      pubkey: event.pubkey,
    };
  } catch {
    return {
      pubkey: event.pubkey,
    };
  }
}

export function calculateEvaluationStats(
  evaluations: PostEvaluation[]
): EvaluationStats {
  const positive = evaluations.filter((e) => e.rating === "+").length;
  const negative = evaluations.filter((e) => e.rating === "-").length;
  const total = positive + negative;
  const score = total > 0 ? (positive - negative) / total : 0;

  return { positive, negative, total, score };
}

export function combinePostsWithStats(
  posts: DiscussionPost[],
  evaluations: PostEvaluation[]
): PostWithStats[] {
  return posts.map((post) => {
    const postEvaluations = evaluations.filter((e) => e.postId === post.id);
    const evaluationStats = calculateEvaluationStats(postEvaluations);

    return {
      ...post,
      evaluationStats,
    };
  });
}

export function sortPostsByScore(
  posts: PostWithStats[],
  ascending: boolean = false
): PostWithStats[] {
  return [...posts].sort((a, b) => {
    const scoreA = a.evaluationStats.score;
    const scoreB = b.evaluationStats.score;
    return ascending ? scoreA - scoreB : scoreB - scoreA;
  });
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function filterUnevaluatedPosts(
  posts: PostWithStats[],
  userEvaluations: Set<string>
): PostWithStats[] {
  return posts.filter((post) => !userEvaluations.has(post.id));
}

export function createAuditTimeline(
  discussions: Discussion[],
  requests: DiscussionRequest[],
  posts: DiscussionPost[],
  approvals: PostApproval[]
): AuditTimelineItem[] {
  const items: AuditTimelineItem[] = [];

  requests.forEach((request) => {
    items.push({
      id: request.id,
      type: "discussion-request",
      timestamp: request.createdAt,
      actorPubkey: request.requesterPubkey,
      targetId: request.adminPubkey,
      description: `会話「${request.title}」の作成をリクエストしました`,
      event: request.event,
    });
  });

  discussions.forEach((discussion) => {
    items.push({
      id: discussion.id,
      type: "discussion-created",
      timestamp: discussion.createdAt,
      actorPubkey: discussion.authorPubkey,
      targetId: discussion.id,
      description: `会話「${discussion.title}」を作成しました`,
      event: discussion.event,
    });
  });

  posts.forEach((post) => {
    items.push({
      id: post.id,
      type: "post-submitted",
      timestamp: post.createdAt,
      actorPubkey: post.authorPubkey,
      targetId: post.discussionId,
      description: "新しい投稿を提出しました",
      event: post.event,
    });
  });

  approvals.forEach((approval) => {
    items.push({
      id: approval.id,
      type: "post-approved",
      timestamp: approval.createdAt,
      actorPubkey: approval.moderatorPubkey,
      targetId: approval.postId,
      description: "投稿を承認しました",
      event: approval.event,
    });
  });

  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export function isAdmin(
  userPubkey: string | null | undefined,
  adminPubkey: string
): boolean {
  return userPubkey === adminPubkey;
}

export function isModerator(
  userPubkey: string | null | undefined,
  moderators: string[],
  adminPubkey?: string
): boolean {
  if (userPubkey === null || userPubkey === undefined) return false;

  // 管理者もモデレーターとみなす
  if (adminPubkey && userPubkey === adminPubkey) return true;

  return moderators.includes(userPubkey);
}

export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}日前`;

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export function validateDiscussionForm(data: {
  title: string;
  description: string;
}): string[] {
  const errors: string[] = [];

  if (!data.title?.trim()) {
    errors.push("タイトルは必須です");
  }

  if (!data.description?.trim()) {
    errors.push("説明は必須です");
  }

  return errors;
}

export function validatePostForm(data: {
  content: string;
  busStopTag?: string;
}): string[] {
  const errors: string[] = [];

  if (!data.content?.trim()) {
    errors.push("投稿内容は必須です");
  }

  if (data.content && data.content.length > 280) {
    errors.push("投稿内容は280文字以内で入力してください");
  }

  return errors;
}

export function extractNip19References(content: string): string[] {
  const nip19Regex =
    /(npub|nsec|note|nprofile|nevent|naddr|nrelay)1[a-zA-Z0-9]+/g;
  return content.match(nip19Regex) || [];
}

export function sanitizeContent(content: string): string {
  return content
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// NIP-19 utility functions
export function hexToNpub(hex: string): string {
  try {
    return nip19.npubEncode(hex);
  } catch (error) {
    logger.error("Failed to encode npub:", error);
    return hex; // fallback to hex
  }
}

export function npubToHex(npub: string): string {
  try {
    if (npub.startsWith("npub")) {
      const { type, data } = nip19.decode(npub);
      if (type === "npub") {
        return data as string;
      }
    }
    // If it's already hex or invalid, return as-is
    return npub;
  } catch (error) {
    logger.error("Failed to decode npub:", error);
    return npub; // fallback
  }
}

export function isValidNpub(npub: string): boolean {
  try {
    if (npub.startsWith("npub")) {
      const { type } = nip19.decode(npub);
      return type === "npub";
    }
    // Also accept hex format (64 characters)
    return /^[a-fA-F0-9]{64}$/.test(npub);
  } catch {
    return false;
  }
}

// spec_v2.md要件: 承認されたユーザー作成会話のパース
export function parseApprovedUserDiscussion(
  userDiscussion: Event,
  approvalEvent: Event,
  approvedAt: number
): Discussion | null {
  const baseDiscussion = parseDiscussionEvent(userDiscussion);
  if (!baseDiscussion) return null;

  // 承認情報を追加
  return {
    ...baseDiscussion,
    approvedAt,
    approvalReference: `34550:${approvalEvent.pubkey}:${approvalEvent.tags.find(tag => tag[0] === "d")?.[1] || ""}`,
  };
}

// spec_v2.md要件: 会話承認イベントのパース
export function parseDiscussionApprovalEvent(event: Event): {
  id: string;
  dTag: string;
  title: string;
  description: string;
  references: string[];
  authorPubkey: string;
  createdAt: number;
  event: Event;
} | null {
  if (event.kind !== 34550) return null;

  const dTag = event.tags.find((tag) => tag[0] === "d")?.[1];
  const name = event.tags.find((tag) => tag[0] === "name")?.[1];
  const description = event.tags.find((tag) => tag[0] === "description")?.[1];

  if (!dTag) return null;

  // NIP-18 qタグから引用を抽出
  const references = event.tags
    .filter((tag) => tag[0] === "q")
    .map((tag) => tag[1])
    .filter(Boolean);

  return {
    id: `34550:${event.pubkey}:${dTag}`,
    dTag,
    title: name || dTag,
    description: description || event.content,
    references,
    authorPubkey: event.pubkey,
    createdAt: event.created_at,
    event,
  };
}

// Environment variable utilities - assumes env vars are stored as npub
export function getAdminPubkeyHex(): string {
  const npubFromEnv = process.env.NEXT_PUBLIC_ADMIN_PUBKEY || "";
  if (!npubFromEnv) {
    logger.warn("NEXT_PUBLIC_ADMIN_PUBKEY is not set");
    return "";
  }
  return npubToHex(npubFromEnv);
}

export function getModeratorPubkeysHex(): string[] {
  const npubsFromEnv = process.env.NEXT_PUBLIC_MODERATORS || "";
  if (!npubsFromEnv) {
    return [];
  }

  // Comma-separated npub values
  return npubsFromEnv
    .split(",")
    .map((npub) => npub.trim())
    .filter((npub) => npub.length > 0)
    .map((npub) => npubToHex(npub));
}
