/**
 * Discussion enhancement utilities for fetching Kind:34550 details
 * and creating audit timelines with admin/moderator names
 */

import { createNostrService } from '@/lib/nostr/nostr-service';
import { getNostrServiceConfig } from '@/lib/config/discussion-config';
import { parseDiscussionEvent } from '@/lib/nostr/nostr-utils';
import { logger } from '@/utils/logger';
import type { ProcessedDiscussion } from './discussion-processing';
import type { Event as NostrEvent } from 'nostr-tools';

const nostrService = createNostrService(getNostrServiceConfig());

export interface DiscussionDetails {
  id: string;
  dTag: string;
  title: string;
  description: string;
  authorPubkey: string;
  createdAt: number;
}

export interface EnhancedProcessedDiscussion extends ProcessedDiscussion {
  discussionDetails?: DiscussionDetails;
}

export interface AuditTimelineEntry {
  id: string;
  type: 'approval' | 'revocation';
  pubkey: string;
  profileName: string;
  role: 'admin' | 'moderator';
  createdAt: number;
  content?: string;
}

/**
 * Fetch Kind:34550 discussion details from hex ID
 */
export async function fetchDiscussionDetails(hexId: string): Promise<DiscussionDetails> {
  try {
    const event = await nostrService.getEventByNaddr(hexId);
    
    if (!event) {
      // Return fallback details when event not found
      const parts = hexId.split(':');
      const identifier = parts[2] || 'unknown';
      const pubkey = parts[1] || 'unknown';
      
      return {
        id: identifier,
        dTag: identifier,
        title: 'Discussion (詳細読み込み失敗)',
        description: '詳細を取得できませんでした',
        authorPubkey: pubkey,
        createdAt: 0,
      };
    }

    const parsed = parseDiscussionEvent(event);
    if (!parsed) {
      throw new Error('Failed to parse discussion event');
    }
    return {
      id: event.id,
      dTag: parsed.dTag,
      title: parsed.title,
      description: parsed.description,
      authorPubkey: event.pubkey,
      createdAt: event.created_at,
    };
  } catch (error) {
    logger.error('Failed to fetch discussion details:', error);
    
    // Return fallback details on error
    const parts = hexId.split(':');
    const identifier = parts[2] || 'unknown';
    const pubkey = parts[1] || 'unknown';
    
    return {
      id: identifier,
      dTag: identifier,
      title: 'Discussion (詳細読み込み失敗)',
      description: '詳細を取得できませんでした',
      authorPubkey: pubkey,
      createdAt: 0,
    };
  }
}

/**
 * Enhance processed discussions with Kind:34550 details
 */
export async function enhanceDiscussionsWithDetails(
  discussions: ProcessedDiscussion[]
): Promise<EnhancedProcessedDiscussion[]> {
  const enhanced: EnhancedProcessedDiscussion[] = [];

  for (const discussion of discussions) {
    try {
      const details = await fetchDiscussionDetails(discussion.userDiscussionNaddr);
      enhanced.push({
        ...discussion,
        discussionDetails: details,
      });
    } catch (error) {
      logger.error('Failed to enhance discussion:', error);
      enhanced.push(discussion);
    }
  }

  return enhanced;
}

/**
 * Extract admin and moderator profiles for audit log display
 */
export async function extractModeratorProfiles(
  pubkeys: string[]
): Promise<Record<string, { name?: string; display_name?: string }>> {
  try {
    return await nostrService.getProfiles(pubkeys);
  } catch (error) {
    logger.error('Failed to fetch moderator profiles:', error);
    return {};
  }
}

/**
 * Create audit timeline with admin/moderator names
 */
export async function createAuditTimelineWithNames(
  auditEvents: NostrEvent[],
  adminPubkeys: string[]
): Promise<AuditTimelineEntry[]> {
  // Get all unique pubkeys from audit events
  const pubkeys = [...new Set(auditEvents.map(event => event.pubkey))];
  
  // Fetch profiles for admin/moderator identification
  const profiles = await extractModeratorProfiles(pubkeys);

  return auditEvents.map(event => {
    const profile = profiles[event.pubkey];
    const isAdmin = adminPubkeys.includes(event.pubkey);
    
    // Determine display name and role
    const profileName = profile?.display_name || profile?.name || (isAdmin ? '管理者' : 'モデレーター');
    const role = isAdmin ? 'admin' : 'moderator';

    return {
      id: event.id,
      type: 'approval', // For now, all events are approvals
      pubkey: event.pubkey,
      profileName,
      role,
      createdAt: event.created_at,
      content: event.content,
    };
  });
}