import type { NostrServiceConfig } from '@/lib/nostr/nostr-service'

export interface DiscussionConfig {
  enabled: boolean
  adminPubkey: string
  busStopDiscussionId: string
  moderators: string[]
  relays: {
    url: string
    read: boolean
    write: boolean
  }[]
}

function parseRelays(relayString: string) {
  if (!relayString) return []
  
  return relayString.split(',').map(url => ({
    url: url.trim(),
    read: true,
    write: true
  }))
}

function parseModerators(moderatorString: string): string[] {
  if (!moderatorString) return []
  
  return moderatorString
    .split(',')
    .map(mod => mod.trim())
    .filter(mod => mod.length === 64) // Valid pubkey length
}

export function getDiscussionConfig(): DiscussionConfig {
  const enabled = process.env.NEXT_PUBLIC_DISCUSSIONS_ENABLED === 'true'
  const adminPubkey = process.env.NEXT_PUBLIC_ADMIN_PUBKEY || ''
  const busStopDiscussionId = process.env.NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID || ''
  const moderatorString = process.env.NEXT_PUBLIC_MODERATORS || ''
  const relayString = process.env.NEXT_PUBLIC_NOSTR_RELAYS || 'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol'

  return {
    enabled,
    adminPubkey,
    busStopDiscussionId,
    moderators: parseModerators(moderatorString),
    relays: parseRelays(relayString)
  }
}

export function getNostrServiceConfig(): NostrServiceConfig {
  const config = getDiscussionConfig()
  
  return {
    relays: config.relays,
    defaultTimeout: 5000
  }
}

export function isDiscussionsEnabled(): boolean {
  return getDiscussionConfig().enabled && !!getDiscussionConfig().adminPubkey
}

export function validateDiscussionConfig(): string[] {
  const errors: string[] = []
  const config = getDiscussionConfig()

  if (!config.enabled) {
    return errors // No validation needed if disabled
  }

  if (!config.adminPubkey) {
    errors.push('NEXT_PUBLIC_ADMIN_PUBKEY is required')
  } else if (config.adminPubkey.length !== 64) {
    errors.push('NEXT_PUBLIC_ADMIN_PUBKEY must be 64 characters')
  }

  if (!config.busStopDiscussionId) {
    errors.push('NEXT_PUBLIC_BUS_STOP_DISCUSSION_ID is required')
  }

  if (config.relays.length === 0) {
    errors.push('At least one Nostr relay must be configured')
  }

  config.moderators.forEach((mod, index) => {
    if (mod.length !== 64) {
      errors.push(`Moderator ${index + 1} public key must be 64 characters`)
    }
  })

  return errors
}

// Default moderators list for development
export const DEFAULT_MODERATORS = [
  // Add your moderator public keys here during development
]

// Default relay list
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band', 
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://nostr.wine'
]