'use client'

import React from 'react'
import { isAdmin, isModerator } from '@/lib/nostr/nostr-utils'

interface AdminCheckProps {
  children: React.ReactNode
  adminPubkey: string
  userPubkey?: string | null | undefined
  fallback?: React.ReactNode
}

export function AdminCheck({ 
  children, 
  adminPubkey, 
  userPubkey, 
  fallback 
}: AdminCheckProps) {
  if (!isAdmin(userPubkey, adminPubkey)) {
    return <>{fallback || null}</>
  }

  return <>{children}</>
}

interface ModeratorCheckProps {
  children: React.ReactNode
  moderators: string[]
  userPubkey?: string | null | undefined
  fallback?: React.ReactNode
}

export function ModeratorCheck({ 
  children, 
  moderators, 
  userPubkey, 
  fallback 
}: ModeratorCheckProps) {
  if (!isModerator(userPubkey, moderators)) {
    return <>{fallback || null}</>
  }

  return <>{children}</>
}

interface AuthCheckProps {
  children: React.ReactNode
  isLoggedIn: boolean
  fallback?: React.ReactNode
}

export function AuthCheck({ children, isLoggedIn, fallback }: AuthCheckProps) {
  if (!isLoggedIn) {
    return <>{fallback || null}</>
  }

  return <>{children}</>
}

interface PermissionErrorProps {
  type: 'admin' | 'moderator' | 'auth'
  message?: string
}

export function PermissionError({ type, message }: PermissionErrorProps) {
  const defaultMessages = {
    admin: 'この操作は管理者のみ実行できます。',
    moderator: 'この操作はモデレーターのみ実行できます。',
    auth: 'この操作を実行するにはログインが必要です。'
  }

  return (
    <div className="text-center py-8">
      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
        アクセス権限がありません
      </h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {message || defaultMessages[type]}
      </p>
    </div>
  )
}