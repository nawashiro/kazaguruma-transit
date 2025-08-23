/**
 * NIP-72 compliant discussion processing for management page
 * Processes community posts to extract user discussions and approval status
 */

import type { Event as NostrEvent } from "nostr-tools";

export interface ProcessedDiscussion {
  communityPostId: string;
  userDiscussionNaddr: string;
  authorPubkey: string;
  createdAt: number;
  isApproved: boolean;
  approvalEventId?: string;
  approvedAt?: number;
  approvalContent?: string;
}

export interface ProcessingResult {
  pending: ProcessedDiscussion[];
  approved: ProcessedDiscussion[];
}

/**
 * Process NIP-72 community posts to extract user discussions
 * and determine their approval status
 */
export function processCommunityPosts(
  communityPosts: NostrEvent[],
  approvalEvents: NostrEvent[]
): ProcessingResult {
  const processed: ProcessedDiscussion[] = [];

  // Create approval lookup map
  const approvalMap = new Map<string, NostrEvent>();
  approvalEvents.forEach(approval => {
    // Find the event ID this approval is for
    const eventTag = approval.tags.find(tag => tag[0] === 'e');
    if (eventTag && eventTag[1]) {
      approvalMap.set(eventTag[1], approval);
    }
  });

  // Process each community post
  communityPosts.forEach(post => {
    // NIP-72 spec: Extract user discussion reference from q tag
    const qTag = post.tags.find(tag => tag[0] === 'q');
    if (!qTag || !qTag[1]) {
      return; // Skip posts without q tag
    }

    const userDiscussionNaddr = qTag[1];
    const approval = approvalMap.get(post.id);
    
    const processedDiscussion: ProcessedDiscussion = {
      communityPostId: post.id,
      userDiscussionNaddr,
      authorPubkey: post.pubkey,
      createdAt: post.created_at,
      isApproved: !!approval,
    };

    if (approval) {
      processedDiscussion.approvalEventId = approval.id;
      processedDiscussion.approvedAt = approval.created_at;
      processedDiscussion.approvalContent = approval.content;
    }

    processed.push(processedDiscussion);
  });

  // Separate into pending and approved
  const pending = processed.filter(d => !d.isApproved);
  const approved = processed.filter(d => d.isApproved);

  return { pending, approved };
}

/**
 * Extract discussion details from user discussion naddr
 * This would need to fetch the actual kind:34550 event from relays
 */
export function extractDiscussionDetails(naddr: string) {
  // TODO: Implement naddr parsing and event fetching
  // For now, return basic structure
  return {
    id: naddr,
    dTag: 'unknown',
    title: 'Discussion (details not loaded)',
    description: 'Description not available',
    authorPubkey: 'unknown',
    moderators: [],
    createdAt: Date.now() / 1000,
  };
}