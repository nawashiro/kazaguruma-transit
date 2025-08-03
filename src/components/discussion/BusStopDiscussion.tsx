'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { LoginModal } from './LoginModal'
import { PostPreview } from './PostPreview'
import { EvaluationComponent } from './EvaluationComponent'
import { createNostrService } from '@/lib/nostr/nostr-service'
import { getDiscussionConfig, isDiscussionsEnabled } from '@/lib/config/discussion-config'
import { 
  parsePostEvent,
  parseApprovalEvent,
  parseEvaluationEvent,
  combinePostsWithStats,
  sortPostsByScore,
  validatePostForm
} from '@/lib/nostr/nostr-utils'
import type { 
  DiscussionPost, 
  PostApproval,
  PostEvaluation,
  PostWithStats,
  PostFormData 
} from '@/types/discussion'

interface BusStopDiscussionProps {
  busStops: string[]
  className?: string
}

export function BusStopDiscussion({ busStops, className = '' }: BusStopDiscussionProps) {
  const [posts, setPosts] = useState<DiscussionPost[]>([])
  const [evaluations, setEvaluations] = useState<PostEvaluation[]>([])
  const [userEvaluations, setUserEvaluations] = useState<Set<string>>(new Set())
  const [topPost, setTopPost] = useState<PostWithStats | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showPostForm, setShowPostForm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [postForm, setPostForm] = useState<PostFormData>({
    content: '',
    busStopTag: busStops[0] || ''
  })
  const [errors, setErrors] = useState<string[]>([])

  const { user, signEvent } = useAuth()
  const config = getDiscussionConfig()
  const nostrService = createNostrService({ relays: config.relays, defaultTimeout: 5000 })

  const loadData = useCallback(async () => {
    try {
      const [postsEvents, approvalsEvents, evaluationsEvents] = await Promise.all([
        nostrService.getDiscussionPosts(config.busStopDiscussionId),
        nostrService.getApprovals(config.busStopDiscussionId),
        nostrService.getEvaluations('', config.busStopDiscussionId)
      ])

      const parsedApprovals = approvalsEvents
        .map(parseApprovalEvent)
        .filter((a): a is PostApproval => a !== null)

      const parsedPosts = postsEvents
        .map(event => parsePostEvent(event, parsedApprovals))
        .filter((p): p is DiscussionPost => p !== null)
        .filter(p => p.approved && p.busStopTag && busStops.includes(p.busStopTag))

      const parsedEvaluations = evaluationsEvents
        .map(parseEvaluationEvent)
        .filter((e): e is PostEvaluation => e !== null)

      setPosts(parsedPosts)
      setEvaluations(parsedEvaluations)

      const postsWithStats = combinePostsWithStats(parsedPosts, parsedEvaluations)
      const topPosts = sortPostsByScore(postsWithStats)
      setTopPost(topPosts[0] || null)
    } catch (error) {
      console.error('Failed to load bus stop discussion:', error)
    }
  }, [busStops, config.busStopDiscussionId, nostrService])

  const loadUserEvaluations = useCallback(async () => {
    if (!user.pubkey) return

    try {
      const userEvals = await nostrService.getEvaluations(user.pubkey)
      const evalPostIds = new Set(
        userEvals
          .map(e => e.tags.find(t => t[0] === 'e')?.[1])
          .filter((id): id is string => Boolean(id))
      )
      setUserEvaluations(evalPostIds)
    } catch (error) {
      console.error('Failed to load user evaluations:', error)
    }
  }, [user.pubkey, nostrService])

  useEffect(() => {
    if (isDiscussionsEnabled() && busStops.length > 0) {
      loadData()
    }
  }, [busStops, loadData])

  useEffect(() => {
    if (user.pubkey) {
      loadUserEvaluations()
    }
  }, [user.pubkey, loadUserEvaluations])

  const handlePostSubmit = async () => {
    if (!user.isLoggedIn) {
      setShowLoginModal(true)
      return
    }

    const validationErrors = validatePostForm(postForm)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setErrors([])

    try {
      const eventTemplate = nostrService.createPostEvent(
        postForm.content.trim(),
        config.busStopDiscussionId,
        postForm.busStopTag
      )

      const signedEvent = await signEvent(eventTemplate)
      const published = await nostrService.publishSignedEvent(signedEvent)
      
      if (!published) {
        throw new Error('Failed to publish post to relays')
      }
      
      setPostForm({ content: '', busStopTag: busStops[0] || '' })
      setShowPreview(false)
      setShowPostForm(false)
      await loadData()
    } catch (error) {
      console.error('Failed to submit post:', error)
      setErrors(['投稿の送信に失敗しました'])
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEvaluate = async (postId: string, rating: '+' | '-') => {
    if (!user.isLoggedIn) {
      setShowLoginModal(true)
      return
    }

    try {
      const eventTemplate = nostrService.createEvaluationEvent(
        postId,
        rating,
        config.busStopDiscussionId
      )

      const signedEvent = await signEvent(eventTemplate)
      const published = await nostrService.publishSignedEvent(signedEvent)
      
      if (!published) {
        throw new Error('Failed to publish evaluation to relays')
      }
      
      setUserEvaluations(prev => new Set([...prev, postId]))
      await loadData()
    } catch (error) {
      console.error('Failed to evaluate post:', error)
    }
  }

  if (!isDiscussionsEnabled() || busStops.length === 0) {
    return null
  }

  const approvedPosts = posts.filter(p => p.approved)
  const postsWithStats = combinePostsWithStats(approvedPosts, evaluations)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top rated post display */}
      {topPost && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.903 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.95-.69l1.519-4.674z" />
            </svg>
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              利用者の声
            </span>
            {topPost.busStopTag && (
              <span className="badge badge-primary badge-sm">{topPost.busStopTag}</span>
            )}
          </div>
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {topPost.content}
          </p>
        </div>
      )}

      {/* Post form */}
      {showPostForm ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-4">バス停での体験を投稿</h3>
          
          {!showPreview ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="post-content" className="label">
                  <span className="label-text">投稿内容 *</span>
                </label>
                <textarea
                  id="post-content"
                  value={postForm.content}
                  onChange={(e) => setPostForm(prev => ({ ...prev, content: e.target.value }))}
                  className="textarea textarea-bordered w-full h-24"
                  placeholder="このバス停での体験や意見を投稿してください"
                  required
                  disabled={isSubmitting}
                  maxLength={280}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {postForm.content.length}/280文字
                </div>
              </div>

              <div>
                <label htmlFor="bus-stop-tag" className="label">
                  <span className="label-text">バス停 *</span>
                </label>
                <select
                  id="bus-stop-tag"
                  value={postForm.busStopTag}
                  onChange={(e) => setPostForm(prev => ({ ...prev, busStopTag: e.target.value }))}
                  className="select select-bordered w-full"
                  required
                  disabled={isSubmitting}
                >
                  {busStops.map(stop => (
                    <option key={stop} value={stop}>
                      {stop}
                    </option>
                  ))}
                </select>
              </div>

              {errors.length > 0 && (
                <div className="alert alert-error">
                  <ul className="text-sm">
                    {errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowPostForm(false)}
                  className="btn btn-outline flex-1"
                  disabled={isSubmitting}
                >
                  キャンセル
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className="btn btn-primary flex-1"
                  disabled={!postForm.content.trim() || isSubmitting}
                >
                  プレビュー
                </button>
              </div>
            </div>
          ) : (
            <PostPreview
              content={postForm.content}
              busStopTag={postForm.busStopTag}
              onConfirm={handlePostSubmit}
              onCancel={() => setShowPreview(false)}
              isLoading={isSubmitting}
            />
          )}
        </div>
      ) : (
        <div className="text-center">
          <button
            onClick={() => setShowPostForm(true)}
            className="btn btn-outline btn-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            体験を投稿する
          </button>
        </div>
      )}

      {/* Evaluation component */}
      {postsWithStats.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">投稿を評価</h3>
          <EvaluationComponent
            posts={postsWithStats}
            onEvaluate={handleEvaluate}
            userEvaluations={userEvaluations}
            isRandomOrder={true}
            maxDisplayCount={3}
            title=""
          />
        </div>
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  )
}