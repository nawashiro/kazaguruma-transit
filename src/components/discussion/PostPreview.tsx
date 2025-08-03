'use client'

import React from 'react'

interface PostPreviewProps {
  content: string
  busStopTag?: string
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

export function PostPreview({ 
  content, 
  busStopTag, 
  onConfirm, 
  onCancel, 
  isLoading = false 
}: PostPreviewProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
      <h3 className="text-lg font-medium mb-3">投稿プレビュー</h3>
      
      <div className="mb-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          {busStopTag && (
            <div className="mb-2">
              <span className="badge badge-primary badge-sm">{busStopTag}</span>
            </div>
          )}
          
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {content.split('\n').map((line, index) => (
              <p key={index} className="mb-2 last:mb-0">
                {line || '\u00A0'}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        <p>この投稿はモデレーターによる承認後に表示されます。</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-outline flex-1"
          disabled={isLoading}
        >
          編集に戻る
        </button>
        <button
          onClick={onConfirm}
          className={`btn btn-primary flex-1 ${isLoading ? 'loading' : ''}`}
          disabled={isLoading}
        >
          {isLoading ? '' : '投稿する'}
        </button>
      </div>
    </div>
  )
}