import type { Event } from 'nostr-tools'
import type { 
  Discussion, 
  DiscussionPost, 
  PostApproval, 
  PostEvaluation, 
  DiscussionRequest,
  NostrProfile,
  EvaluationStats,
  PostWithStats,
  AuditTimelineItem
} from '@/types/discussion'

export function parseDiscussionEvent(event: Event): Discussion | null {
  if (event.kind !== 34550) return null

  const dTag = event.tags.find(tag => tag[0] === 'd')?.[1]
  const name = event.tags.find(tag => tag[0] === 'name')?.[1]
  const description = event.tags.find(tag => tag[0] === 'description')?.[1]
  
  if (!dTag) return null

  const moderators = event.tags
    .filter(tag => tag[0] === 'p' && tag[3] === 'moderator')
    .map(tag => ({
      pubkey: tag[1],
      name: undefined
    }))

  return {
    id: `34550:${event.pubkey}:${dTag}`,
    dTag,
    title: name || dTag,
    description: description || event.content,
    moderators,
    authorPubkey: event.pubkey,
    createdAt: event.created_at,
    event
  }
}

export function parsePostEvent(event: Event, approvals: PostApproval[] = []): DiscussionPost | null {
  if (event.kind !== 1111) return null

  const discussionTag = event.tags.find(tag => tag[0] === 'a' || tag[0] === 'A')?.[1]
  const busStopTag = event.tags.find(tag => tag[0] === 't')?.[1]
  
  if (!discussionTag) return null

  const postApprovals = approvals.filter(approval => approval.postId === event.id)
  const approved = postApprovals.length > 0
  const approvedBy = postApprovals.map(approval => approval.moderatorPubkey)
  const approvedAt = postApprovals.length > 0 ? Math.min(...postApprovals.map(a => a.createdAt)) : undefined

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
    event
  }
}

export function parseApprovalEvent(event: Event): PostApproval | null {
  if (event.kind !== 4550) return null

  const discussionTag = event.tags.find(tag => tag[0] === 'a')?.[1]
  const postId = event.tags.find(tag => tag[0] === 'e')?.[1]
  const postAuthorPubkey = event.tags.find(tag => tag[0] === 'p')?.[1]

  if (!discussionTag || !postId || !postAuthorPubkey) return null

  return {
    id: event.id,
    postId,
    postAuthorPubkey,
    moderatorPubkey: event.pubkey,
    discussionId: discussionTag,
    createdAt: event.created_at,
    event
  }
}

export function parseEvaluationEvent(event: Event): PostEvaluation | null {
  if (event.kind !== 7) return null

  const postId = event.tags.find(tag => tag[0] === 'e')?.[1]
  const rating = event.tags.find(tag => tag[0] === 'rating')?.[1] as '+' | '-'
  const discussionId = event.tags.find(tag => tag[0] === 'a')?.[1]

  if (!postId || !rating || (rating !== '+' && rating !== '-')) return null

  return {
    id: event.id,
    postId,
    evaluatorPubkey: event.pubkey,
    rating,
    discussionId,
    createdAt: event.created_at,
    event
  }
}

export function parseDiscussionRequestEvent(event: Event): DiscussionRequest | null {
  if (event.kind !== 1) return null

  const hasDiscussionRequestTag = event.tags.some(tag => tag[0] === 't' && tag[1] === 'discussion-request')
  const adminPubkey = event.tags.find(tag => tag[0] === 'p')?.[1]

  if (!hasDiscussionRequestTag || !adminPubkey) return null

  const lines = event.content.split('\n')
  const titleLine = lines.find(line => line.startsWith('タイトル:'))
  const descriptionStart = lines.findIndex(line => line.startsWith('説明:'))
  
  const title = titleLine?.replace('タイトル:', '').trim() || ''
  const description = descriptionStart >= 0 
    ? lines.slice(descriptionStart + 1).join('\n').trim()
    : ''

  return {
    id: event.id,
    title,
    description,
    requesterPubkey: event.pubkey,
    adminPubkey,
    createdAt: event.created_at,
    event
  }
}

export function parseProfileEvent(event: Event): NostrProfile | null {
  if (event.kind !== 0) return null

  try {
    const content = JSON.parse(event.content)
    return {
      name: content.name,
      about: content.about,
      picture: content.picture,
      pubkey: event.pubkey
    }
  } catch {
    return {
      pubkey: event.pubkey
    }
  }
}

export function calculateEvaluationStats(evaluations: PostEvaluation[]): EvaluationStats {
  const positive = evaluations.filter(e => e.rating === '+').length
  const negative = evaluations.filter(e => e.rating === '-').length
  const total = positive + negative
  const score = total > 0 ? (positive - negative) / total : 0

  return { positive, negative, total, score }
}

export function combinePostsWithStats(
  posts: DiscussionPost[],
  evaluations: PostEvaluation[]
): PostWithStats[] {
  return posts.map(post => {
    const postEvaluations = evaluations.filter(e => e.postId === post.id)
    const evaluationStats = calculateEvaluationStats(postEvaluations)
    
    return {
      ...post,
      evaluationStats
    }
  })
}

export function sortPostsByScore(posts: PostWithStats[], ascending: boolean = false): PostWithStats[] {
  return [...posts].sort((a, b) => {
    const scoreA = a.evaluationStats.score
    const scoreB = b.evaluationStats.score
    return ascending ? scoreA - scoreB : scoreB - scoreA
  })
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function filterUnevaluatedPosts(
  posts: PostWithStats[],
  userEvaluations: Set<string>
): PostWithStats[] {
  return posts.filter(post => !userEvaluations.has(post.id))
}

export function createAuditTimeline(
  discussions: Discussion[],
  requests: DiscussionRequest[],
  posts: DiscussionPost[],
  approvals: PostApproval[]
): AuditTimelineItem[] {
  const items: AuditTimelineItem[] = []

  requests.forEach(request => {
    items.push({
      id: request.id,
      type: 'discussion-request',
      timestamp: request.createdAt,
      actorPubkey: request.requesterPubkey,
      targetId: request.adminPubkey,
      description: `ディスカッション「${request.title}」の作成がリクエストされました`,
      event: request.event
    })
  })

  discussions.forEach(discussion => {
    items.push({
      id: discussion.id,
      type: 'discussion-created',
      timestamp: discussion.createdAt,
      actorPubkey: discussion.authorPubkey,
      targetId: discussion.id,
      description: `ディスカッション「${discussion.title}」が作成されました`,
      event: discussion.event
    })
  })

  posts.forEach(post => {
    items.push({
      id: post.id,
      type: 'post-submitted',
      timestamp: post.createdAt,
      actorPubkey: post.authorPubkey,
      targetId: post.discussionId,
      description: '新しい投稿が提出されました',
      event: post.event
    })
  })

  approvals.forEach(approval => {
    items.push({
      id: approval.id,
      type: 'post-approved',
      timestamp: approval.createdAt,
      actorPubkey: approval.moderatorPubkey,
      targetId: approval.postId,
      description: '投稿が承認されました',
      event: approval.event
    })
  })

  return items.sort((a, b) => b.timestamp - a.timestamp)
}

export function isAdmin(userPubkey: string | null | undefined, adminPubkey: string): boolean {
  return userPubkey === adminPubkey
}

export function isModerator(userPubkey: string | null | undefined, moderators: string[]): boolean {
  return userPubkey !== null && userPubkey !== undefined && moderators.includes(userPubkey)
}

export function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp
  
  if (diff < 60) return '今'
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`
  if (diff < 604800) return `${Math.floor(diff / 86400)}日前`
  
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('ja-JP')
}

export function validateDiscussionForm(data: {
  title: string
  description: string
  dTag: string
}): string[] {
  const errors: string[] = []
  
  if (!data.title?.trim()) {
    errors.push('タイトルは必須です')
  }
  
  if (!data.description?.trim()) {
    errors.push('説明は必須です')
  }
  
  if (!data.dTag?.trim()) {
    errors.push('識別子は必須です')
  } else if (!/^[a-zA-Z0-9_-]+$/.test(data.dTag)) {
    errors.push('識別子は英数字、ハイフン、アンダースコアのみ使用できます')
  }
  
  return errors
}

export function validatePostForm(data: {
  content: string
  busStopTag?: string
}): string[] {
  const errors: string[] = []
  
  if (!data.content?.trim()) {
    errors.push('投稿内容は必須です')
  }
  
  if (data.content && data.content.length > 280) {
    errors.push('投稿内容は280文字以内で入力してください')
  }
  
  return errors
}

export function extractNip19References(content: string): string[] {
  const nip19Regex = /(npub|nsec|note|nprofile|nevent|naddr|nrelay)1[a-zA-Z0-9]+/g
  return content.match(nip19Regex) || []
}

export function sanitizeContent(content: string): string {
  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}