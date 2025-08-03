'use client'

import React from 'react'
import type { AuditTimelineItem } from '@/types/discussion'
import { formatRelativeTime } from '@/lib/nostr/nostr-utils'

interface AuditTimelineProps {
  items: AuditTimelineItem[]
  profiles?: Record<string, { name?: string }>
}

export function AuditTimeline({ items, profiles = {} }: AuditTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
          履歴がありません
        </h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          まだ操作履歴がありません。
        </p>
      </div>
    )
  }

  const getIconByType = (type: AuditTimelineItem['type']) => {
    switch (type) {
      case 'discussion-request':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
      case 'discussion-created':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        )
      case 'discussion-deleted':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )
      case 'post-submitted':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )
      case 'post-approved':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'post-rejected':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
    }
  }

  const getColorByType = (type: AuditTimelineItem['type']) => {
    switch (type) {
      case 'discussion-request':
        return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900'
      case 'discussion-created':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900'
      case 'discussion-deleted':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900'
      case 'post-submitted':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900'
      case 'post-approved':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900'
      case 'post-rejected':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900'
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900'
    }
  }

  return (
    <div className="timeline timeline-vertical">
      {items.map((item, index) => (
        <div key={item.id} className="timeline-item">
          <div className="timeline-start">
            <time className="text-sm text-gray-500 dark:text-gray-400">
              {formatRelativeTime(item.timestamp)}
            </time>
          </div>
          
          <div className="timeline-middle">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getColorByType(item.type)}`}>
              {getIconByType(item.type)}
            </div>
          </div>
          
          <div className="timeline-end timeline-box">
            <div className="mb-2">
              <span className="font-medium">
                {profiles[item.actorPubkey]?.name || `${item.actorPubkey.slice(0, 8)}...`}
              </span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {item.description}
            </p>
          </div>
          
          {index < items.length - 1 && <hr />}
        </div>
      ))}
    </div>
  )
}