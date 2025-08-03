'use client'

// Force dynamic rendering to avoid SSR issues with AuthProvider
export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/auth-context'
import { isDiscussionsEnabled } from '@/lib/config/discussion-config'
import { AdminCheck, PermissionError } from '@/components/discussion/PermissionGuards'
import { createNostrService } from '@/lib/nostr/nostr-service'
import { 
  parseDiscussionEvent, 
  parseDiscussionRequestEvent,
  validateDiscussionForm,
  formatRelativeTime
} from '@/lib/nostr/nostr-utils'
import type { Discussion, DiscussionRequest, DiscussionFormData } from '@/types/discussion'

const ADMIN_PUBKEY = process.env.NEXT_PUBLIC_ADMIN_PUBKEY || ''
const RELAYS = [
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://relay.nostr.band', read: true, write: true },
  { url: 'wss://nos.lol', read: true, write: true }
]

const nostrService = createNostrService({ relays: RELAYS, defaultTimeout: 5000 })

export default function DiscussionManagePage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [requests, setRequests] = useState<DiscussionRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<DiscussionFormData>({
    title: '',
    description: '',
    dTag: '',
    moderators: []
  })
  const [moderatorInput, setModeratorInput] = useState('')
  const [errors, setErrors] = useState<string[]>([])

  const { user, signEvent } = useAuth()

  useEffect(() => {
    if (isDiscussionsEnabled()) {
      loadData()
    }
  }, [])

  // Check if discussions are enabled and render accordingly
  if (!isDiscussionsEnabled()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">ディスカッション管理</h1>
          <p className="text-gray-600">この機能は現在利用できません。</p>
        </div>
      </div>
    )
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [discussionEvents, requestEvents] = await Promise.all([
        nostrService.getDiscussions(ADMIN_PUBKEY),
        nostrService.getDiscussionRequests(ADMIN_PUBKEY)
      ])

      const parsedDiscussions = discussionEvents
        .map(parseDiscussionEvent)
        .filter((d): d is Discussion => d !== null)
        .sort((a, b) => b.createdAt - a.createdAt)

      const parsedRequests = requestEvents
        .map(parseDiscussionRequestEvent)
        .filter((r): r is DiscussionRequest => r !== null)
        .sort((a, b) => b.createdAt - a.createdAt)

      setDiscussions(parsedDiscussions)
      setRequests(parsedRequests)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateDiscussionForm(createForm)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setErrors([])

    try {
      const eventTemplate = nostrService.createDiscussionEvent(
        createForm.title.trim(),
        createForm.description.trim(),
        createForm.moderators,
        createForm.dTag.trim()
      )

      const signedEvent = await signEvent(eventTemplate)
      const published = await nostrService.publishSignedEvent(signedEvent)
      
      if (!published) {
        throw new Error('Failed to publish event to relays')
      }
      
      setCreateForm({
        title: '',
        description: '',
        dTag: '',
        moderators: []
      })
      setModeratorInput('')
      await loadData()
    } catch (error) {
      console.error('Failed to create discussion:', error)
      setErrors(['ディスカッションの作成に失敗しました'])
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteDiscussion = async (discussionId: string) => {
    if (!confirm('このディスカッションを削除してもよろしいですか？')) {
      return
    }

    setDeletingId(discussionId)
    try {
      const discussion = discussions.find(d => d.id === discussionId)
      if (!discussion) return

      const deleteEvent = nostrService.createDeleteEvent(discussion.event.id)
      await signEvent(deleteEvent)
      
      await loadData()
    } catch (error) {
      console.error('Failed to delete discussion:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const addModerator = () => {
    const trimmed = moderatorInput.trim()
    if (trimmed && !createForm.moderators.includes(trimmed)) {
      setCreateForm(prev => ({
        ...prev,
        moderators: [...prev.moderators, trimmed]
      }))
      setModeratorInput('')
    }
  }

  const removeModerator = (pubkey: string) => {
    setCreateForm(prev => ({
      ...prev,
      moderators: prev.moderators.filter(m => m !== pubkey)
    }))
  }

  const generateDTag = () => {
    const slug = createForm.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30)
    
    const timestamp = Date.now().toString().slice(-6)
    setCreateForm(prev => ({
      ...prev,
      dTag: `${slug}-${timestamp}`
    }))
  }

  return (
    <AdminCheck
      adminPubkey={ADMIN_PUBKEY}
      userPubkey={user.pubkey}
      fallback={<PermissionError type="admin" />}
    >
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <Link href="/discussions" className="btn btn-ghost btn-sm">
              ← ディスカッション一覧
            </Link>
            <h1 className="text-3xl font-bold">ディスカッション管理</h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">新しいディスカッション作成</h2>
            
            <div className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="card-body">
                <form onSubmit={handleCreateSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="create-title" className="label">
                      <span className="label-text">タイトル *</span>
                    </label>
                    <input
                      type="text"
                      id="create-title"
                      value={createForm.title}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                      className="input input-bordered w-full"
                      placeholder="ディスカッションのタイトル"
                      required
                      disabled={isSubmitting}
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label htmlFor="create-description" className="label">
                      <span className="label-text">説明 *</span>
                    </label>
                    <textarea
                      id="create-description"
                      value={createForm.description}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                      className="textarea textarea-bordered w-full h-24"
                      placeholder="ディスカッションの目的や内容"
                      required
                      disabled={isSubmitting}
                      maxLength={500}
                    />
                  </div>

                  <div>
                    <label htmlFor="create-dtag" className="label">
                      <span className="label-text">識別子 *</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="create-dtag"
                        value={createForm.dTag}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, dTag: e.target.value }))}
                        className="input input-bordered flex-1"
                        placeholder="英数字-_のみ"
                        pattern="[a-zA-Z0-9_\-]+"
                        required
                        disabled={isSubmitting}
                        maxLength={50}
                      />
                      <button
                        type="button"
                        onClick={generateDTag}
                        className="btn btn-outline"
                        disabled={isSubmitting || !createForm.title}
                      >
                        自動生成
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="moderator-input" className="label">
                      <span className="label-text">モデレーター</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        id="moderator-input"
                        value={moderatorInput}
                        onChange={(e) => setModeratorInput(e.target.value)}
                        className="input input-bordered flex-1"
                        placeholder="公開鍵（64文字）"
                        pattern="[a-fA-F0-9]{64}"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={addModerator}
                        className="btn btn-outline"
                        disabled={isSubmitting || !moderatorInput.trim()}
                      >
                        追加
                      </button>
                    </div>
                    
                    {createForm.moderators.length > 0 && (
                      <div className="space-y-1">
                        {createForm.moderators.map(mod => (
                          <div key={mod} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                            <span className="font-mono text-sm flex-1">
                              {mod.slice(0, 8)}...{mod.slice(-8)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeModerator(mod)}
                              className="btn btn-ghost btn-xs text-error"
                              disabled={isSubmitting}
                            >
                              削除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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

                  <button
                    type="submit"
                    className={`btn btn-primary w-full ${isSubmitting ? 'loading' : ''}`}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? '' : 'ディスカッション作成'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">リクエスト一覧</h2>
              
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : requests.length > 0 ? (
                <div className="space-y-3">
                  {requests.map(request => (
                    <div key={request.id} className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                      <div className="card-body p-4">
                        <h3 className="font-medium">{request.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {request.description}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(request.createdAt)}
                          </span>
                          <span className="text-xs font-mono">
                            {request.requesterPubkey.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">リクエストはありません。</p>
              )}
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">既存のディスカッション</h2>
              
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : discussions.length > 0 ? (
                <div className="space-y-3">
                  {discussions.map(discussion => (
                    <div key={discussion.id} className="card bg-base-100 shadow-sm border border-gray-200 dark:border-gray-700">
                      <div className="card-body p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium">{discussion.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {discussion.description}
                            </p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-xs text-gray-500">
                                {formatRelativeTime(discussion.createdAt)}
                              </span>
                              <span className="badge badge-outline badge-xs">
                                {discussion.moderators.length} モデレーター
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Link
                              href={`/discussions/${discussion.dTag}`}
                              className="btn btn-ghost btn-sm"
                            >
                              表示
                            </Link>
                            <button
                              onClick={() => handleDeleteDiscussion(discussion.id)}
                              className={`btn btn-error btn-sm ${
                                deletingId === discussion.id ? 'loading' : ''
                              }`}
                              disabled={deletingId === discussion.id}
                            >
                              {deletingId === discussion.id ? '' : '削除'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">ディスカッションはありません。</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminCheck>
  )
}