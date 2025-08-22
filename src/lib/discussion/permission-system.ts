import type { Discussion } from '@/types/discussion';
import { isAdmin, isModerator } from '@/lib/nostr/nostr-utils';

export interface ProfileDisplayInfo {
  name?: string;
  showName: boolean;
  badges: string[];
}

export function isDiscussionCreator(
  userPubkey: string | null | undefined,
  discussion: Discussion
): boolean {
  if (!userPubkey) return false;
  return userPubkey === discussion.authorPubkey;
}

export function canEditDiscussion(
  userPubkey: string | null | undefined,
  discussion: Discussion,
  adminPubkey: string
): boolean {
  if (!userPubkey) return false;
  
  return isAdmin(userPubkey, adminPubkey) || 
         isDiscussionCreator(userPubkey, discussion);
}

export function canDeleteDiscussion(
  userPubkey: string | null | undefined,
  discussion: Discussion,
  adminPubkey: string
): boolean {
  if (!userPubkey) return false;
  
  return isAdmin(userPubkey, adminPubkey) || 
         isDiscussionCreator(userPubkey, discussion);
}

export function canApprovePost(
  userPubkey: string | null | undefined,
  discussion: Discussion,
  adminPubkey: string
): boolean {
  if (!userPubkey) return false;
  
  const moderatorPubkeys = discussion.moderators.map(m => m.pubkey);
  
  return isAdmin(userPubkey, adminPubkey) ||
         isModerator(userPubkey, moderatorPubkeys, adminPubkey) ||
         isDiscussionCreator(userPubkey, discussion);
}

export function canViewAuditWithNames(
  userPubkey: string | null | undefined,
  discussion: Discussion,
  adminPubkey: string
): boolean {
  if (!userPubkey) return false;
  
  const moderatorPubkeys = discussion.moderators.map(m => m.pubkey);
  
  return isAdmin(userPubkey, adminPubkey) ||
         isModerator(userPubkey, moderatorPubkeys, adminPubkey);
}

export function shouldShowCreatorBadge(
  targetPubkey: string,
  discussion: Discussion
): boolean {
  return targetPubkey === discussion.authorPubkey;
}

export function shouldShowModeratorBadge(
  targetPubkey: string,
  discussion: Discussion,
  adminPubkey: string
): boolean {
  const moderatorPubkeys = discussion.moderators.map(m => m.pubkey);
  
  return isAdmin(targetPubkey, adminPubkey) ||
         isModerator(targetPubkey, moderatorPubkeys, adminPubkey);
}

export function getVisibleProfileInfo(
  targetPubkey: string,
  profiles: Record<string, { name?: string }>,
  viewerPubkey: string | null | undefined,
  discussion: Discussion,
  adminPubkey: string
): ProfileDisplayInfo {
  const badges: string[] = [];
  
  if (shouldShowCreatorBadge(targetPubkey, discussion)) {
    badges.push('作成者');
  }
  
  if (shouldShowModeratorBadge(targetPubkey, discussion, adminPubkey)) {
    badges.push('モデレーター');
  }
  
  const canViewNames = canViewAuditWithNames(viewerPubkey, discussion, adminPubkey);
  const profile = profiles[targetPubkey];
  
  return {
    name: canViewNames ? profile?.name : undefined,
    showName: canViewNames,
    badges,
  };
}