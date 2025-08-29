/**
 * Tests for discussion permission system
 * Based on spec_v2.md permission requirements
 */

import {
  isDiscussionCreator,
  canEditDiscussion,
  canDeleteDiscussion,
  canApprovePost,
  canViewAuditWithNames,
  shouldShowCreatorBadge,
  shouldShowModeratorBadge,
  getVisibleProfileInfo,
} from '../permission-system';
import type { Discussion } from '@/types/discussion';

jest.mock('@/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Discussion Permission System', () => {
  const adminPubkey = 'admin123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde';
  const moderatorPubkey1 = 'mod1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde';
  const moderatorPubkey2 = 'mod2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde';
  const creatorPubkey = 'creator123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd';
  const regularUserPubkey = 'user123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde';

  const mockDiscussion: Discussion = {
    id: '34550:creator123...:test-discussion',
    dTag: 'test-discussion',
    title: 'テスト会話',
    description: 'テスト用の会話です',
    moderators: [
      { pubkey: moderatorPubkey1, name: 'モデレーター1' },
      { pubkey: moderatorPubkey2, name: 'モデレーター2' },
    ],
    authorPubkey: creatorPubkey,
    createdAt: Math.floor(Date.now() / 1000),
    event: {} as any,
  };

  describe('isDiscussionCreator', () => {
    test('should return true for discussion creator', () => {
      const result = isDiscussionCreator(creatorPubkey, mockDiscussion);
      expect(result).toBe(true);
    });

    test('should return false for non-creator', () => {
      expect(isDiscussionCreator(regularUserPubkey, mockDiscussion)).toBe(false);
      expect(isDiscussionCreator(adminPubkey, mockDiscussion)).toBe(false);
      expect(isDiscussionCreator(moderatorPubkey1, mockDiscussion)).toBe(false);
    });

    test('should return false for null/undefined pubkey', () => {
      expect(isDiscussionCreator(null, mockDiscussion)).toBe(false);
      expect(isDiscussionCreator(undefined, mockDiscussion)).toBe(false);
    });
  });

  describe('canEditDiscussion', () => {
    test('should allow discussion creator to edit', () => {
      const result = canEditDiscussion(creatorPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(true);
    });

    test('should allow admin to edit any discussion', () => {
      const result = canEditDiscussion(adminPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(true);
    });

    test('should not allow regular users to edit', () => {
      const result = canEditDiscussion(regularUserPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(false);
    });

    test('should not allow moderators to edit (creator-only per spec)', () => {
      const result = canEditDiscussion(moderatorPubkey1, mockDiscussion, adminPubkey);
      expect(result).toBe(false);
    });
  });

  describe('canDeleteDiscussion', () => {
    test('should allow discussion creator to delete', () => {
      const result = canDeleteDiscussion(creatorPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(true);
    });

    test('should allow admin to delete any discussion', () => {
      const result = canDeleteDiscussion(adminPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(true);
    });

    test('should not allow regular users to delete', () => {
      const result = canDeleteDiscussion(regularUserPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(false);
    });

    test('should not allow moderators to delete', () => {
      const result = canDeleteDiscussion(moderatorPubkey1, mockDiscussion, adminPubkey);
      expect(result).toBe(false);
    });
  });

  describe('canApprovePost', () => {
    test('should allow discussion creator to approve posts', () => {
      const result = canApprovePost(creatorPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(true);
    });

    test('should allow admin to approve posts', () => {
      const result = canApprovePost(adminPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(true);
    });

    test('should allow moderators to approve posts', () => {
      expect(canApprovePost(moderatorPubkey1, mockDiscussion, adminPubkey)).toBe(true);
      expect(canApprovePost(moderatorPubkey2, mockDiscussion, adminPubkey)).toBe(true);
    });

    test('should not allow regular users to approve posts', () => {
      const result = canApprovePost(regularUserPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(false);
    });
  });

  describe('canViewAuditWithNames', () => {
    test('should allow admin to view names in audit log', () => {
      const result = canViewAuditWithNames(adminPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(true);
    });

    test('should allow moderators to view names in audit log', () => {
      expect(canViewAuditWithNames(moderatorPubkey1, mockDiscussion, adminPubkey)).toBe(true);
      expect(canViewAuditWithNames(moderatorPubkey2, mockDiscussion, adminPubkey)).toBe(true);
    });

    test('should not allow regular users to view names in audit log', () => {
      const result = canViewAuditWithNames(regularUserPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(false);
    });

    test('should not allow discussion creator to view names (unless they are also moderator)', () => {
      // Creator who is not moderator or admin
      const result = canViewAuditWithNames(creatorPubkey, mockDiscussion, adminPubkey);
      expect(result).toBe(false);
    });
  });

  describe('badge display functions', () => {
    describe('shouldShowCreatorBadge', () => {
      test('should show creator badge for discussion creator', () => {
        const result = shouldShowCreatorBadge(creatorPubkey, mockDiscussion);
        expect(result).toBe(true);
      });

      test('should not show creator badge for non-creators', () => {
        expect(shouldShowCreatorBadge(adminPubkey, mockDiscussion)).toBe(false);
        expect(shouldShowCreatorBadge(moderatorPubkey1, mockDiscussion)).toBe(false);
        expect(shouldShowCreatorBadge(regularUserPubkey, mockDiscussion)).toBe(false);
      });
    });

    describe('shouldShowModeratorBadge', () => {
      test('should show moderator badge for moderators', () => {
        expect(shouldShowModeratorBadge(moderatorPubkey1, mockDiscussion, adminPubkey)).toBe(true);
        expect(shouldShowModeratorBadge(moderatorPubkey2, mockDiscussion, adminPubkey)).toBe(true);
      });

      test('should show moderator badge for admin', () => {
        const result = shouldShowModeratorBadge(adminPubkey, mockDiscussion, adminPubkey);
        expect(result).toBe(true);
      });

      test('should not show moderator badge for regular users', () => {
        const result = shouldShowModeratorBadge(regularUserPubkey, mockDiscussion, adminPubkey);
        expect(result).toBe(false);
      });

      test('should not show moderator badge for creator (unless they are also moderator)', () => {
        const result = shouldShowModeratorBadge(creatorPubkey, mockDiscussion, adminPubkey);
        expect(result).toBe(false);
      });
    });
  });

  describe('getVisibleProfileInfo', () => {
    const mockProfiles = {
      [adminPubkey]: { name: '管理者' },
      [moderatorPubkey1]: { name: 'モデレーター1' },
      [creatorPubkey]: { name: '作成者' },
      [regularUserPubkey]: { name: '一般ユーザー' },
    };

    test('should return name for admin and moderators when viewer has permission', () => {
      // Admin viewing
      const adminView = getVisibleProfileInfo(adminPubkey, mockProfiles, adminPubkey, mockDiscussion, adminPubkey);
      expect(adminView.name).toBe('管理者');
      expect(adminView.showName).toBe(true);
      expect(adminView.badges).toContain('モデレーター');
      
      const modView = getVisibleProfileInfo(moderatorPubkey1, mockProfiles, adminPubkey, mockDiscussion, adminPubkey);
      expect(modView.name).toBe('モデレーター1');
      expect(modView.showName).toBe(true);
      expect(modView.badges).toContain('モデレーター');
    });

    test('should hide names when viewer lacks permission', () => {
      // Regular user viewing
      const userViewAdmin = getVisibleProfileInfo(adminPubkey, mockProfiles, regularUserPubkey, mockDiscussion, adminPubkey);
      expect(userViewAdmin.name).toBeUndefined();
      expect(userViewAdmin.showName).toBe(false);
      expect(userViewAdmin.badges).toContain('モデレーター');
      
      const userViewCreator = getVisibleProfileInfo(creatorPubkey, mockProfiles, regularUserPubkey, mockDiscussion, adminPubkey);
      expect(userViewCreator.name).toBeUndefined();
      expect(userViewCreator.showName).toBe(false);
      expect(userViewCreator.badges).toContain('作成者');
    });

    test('should show appropriate badges based on user role', () => {
      // Check creator badge visibility
      const creatorInfo = getVisibleProfileInfo(creatorPubkey, mockProfiles, regularUserPubkey, mockDiscussion, adminPubkey);
      expect(creatorInfo.badges).toContain('作成者');

      // Check moderator badge visibility
      const modInfo = getVisibleProfileInfo(moderatorPubkey1, mockProfiles, regularUserPubkey, mockDiscussion, adminPubkey);
      expect(modInfo.badges).toContain('モデレーター');

      // Check admin badge visibility (admin is also considered moderator)
      const adminInfo = getVisibleProfileInfo(adminPubkey, mockProfiles, regularUserPubkey, mockDiscussion, adminPubkey);
      expect(adminInfo.badges).toContain('モデレーター');
    });
  });

  describe('edge cases and security', () => {
    test('should handle null/undefined inputs safely', () => {
      expect(isDiscussionCreator(null, mockDiscussion)).toBe(false);
      expect(canEditDiscussion(undefined, mockDiscussion, adminPubkey)).toBe(false);
      expect(canApprovePost(null, mockDiscussion, adminPubkey)).toBe(false);
    });

    test('should handle discussion with no moderators', () => {
      const discussionNoMods: Discussion = {
        ...mockDiscussion,
        moderators: [],
      };

      expect(canApprovePost(moderatorPubkey1, discussionNoMods, adminPubkey)).toBe(false);
      expect(canApprovePost(adminPubkey, discussionNoMods, adminPubkey)).toBe(true); // Admin still can
      expect(canApprovePost(creatorPubkey, discussionNoMods, adminPubkey)).toBe(true); // Creator still can
    });

    test('should not leak sensitive information', () => {
      const sensitiveProfiles = {
        [regularUserPubkey]: { 
          name: '機密ユーザー',
          email: 'secret@example.com', // Should not be exposed
        },
      };

      const result = getVisibleProfileInfo(
        regularUserPubkey, 
        sensitiveProfiles, 
        regularUserPubkey, 
        mockDiscussion, 
        adminPubkey
      );

      expect(result).not.toHaveProperty('email');
      expect(Object.keys(result)).toEqual(['name', 'showName', 'badges']);
    });
  });

  describe('spec_v2.md compliance for audit log privacy', () => {
    test('should implement privacy policy correctly', () => {
      // According to spec: "管理者とスタッフ以外のユーザー名を明かさない方針"
      
      // Regular user viewing audit log - should not see names
      const regularUserView = getVisibleProfileInfo(
        creatorPubkey,
        { [creatorPubkey]: { name: '作成者名' } },
        regularUserPubkey,
        mockDiscussion,
        adminPubkey
      );
      
      expect(regularUserView.showName).toBe(false);
      expect(regularUserView.badges).toContain('作成者');

      // Admin viewing audit log - should see names
      const adminView = getVisibleProfileInfo(
        creatorPubkey,
        { [creatorPubkey]: { name: '作成者名' } },
        adminPubkey,
        mockDiscussion,
        adminPubkey
      );
      
      expect(adminView.showName).toBe(true);
      expect(adminView.name).toBe('作成者名');
    });

    test('should handle mixed permission scenarios', () => {
      // Creator who is also moderator
      const creatorModDiscussion: Discussion = {
        ...mockDiscussion,
        moderators: [
          ...mockDiscussion.moderators,
          { pubkey: creatorPubkey, name: '作成者兼モデレーター' },
        ],
      };

      const result = shouldShowModeratorBadge(creatorPubkey, creatorModDiscussion, adminPubkey);
      expect(result).toBe(true); // Should show moderator badge
      
      const creatorResult = shouldShowCreatorBadge(creatorPubkey, creatorModDiscussion);
      expect(creatorResult).toBe(true); // Should also show creator badge
    });
  });

  describe('permission inheritance and hierarchy', () => {
    test('should respect admin > moderator > creator > user hierarchy', () => {
      // Admin should have all permissions
      expect(canEditDiscussion(adminPubkey, mockDiscussion, adminPubkey)).toBe(true);
      expect(canDeleteDiscussion(adminPubkey, mockDiscussion, adminPubkey)).toBe(true);
      expect(canApprovePost(adminPubkey, mockDiscussion, adminPubkey)).toBe(true);
      expect(canViewAuditWithNames(adminPubkey, mockDiscussion, adminPubkey)).toBe(true);

      // Moderator should have limited permissions
      expect(canEditDiscussion(moderatorPubkey1, mockDiscussion, adminPubkey)).toBe(false);
      expect(canDeleteDiscussion(moderatorPubkey1, mockDiscussion, adminPubkey)).toBe(false);
      expect(canApprovePost(moderatorPubkey1, mockDiscussion, adminPubkey)).toBe(true);
      expect(canViewAuditWithNames(moderatorPubkey1, mockDiscussion, adminPubkey)).toBe(true);

      // Creator should have creator-specific permissions
      expect(canEditDiscussion(creatorPubkey, mockDiscussion, adminPubkey)).toBe(true);
      expect(canDeleteDiscussion(creatorPubkey, mockDiscussion, adminPubkey)).toBe(true);
      expect(canApprovePost(creatorPubkey, mockDiscussion, adminPubkey)).toBe(true);
      expect(canViewAuditWithNames(creatorPubkey, mockDiscussion, adminPubkey)).toBe(false);

      // Regular user should have minimal permissions
      expect(canEditDiscussion(regularUserPubkey, mockDiscussion, adminPubkey)).toBe(false);
      expect(canDeleteDiscussion(regularUserPubkey, mockDiscussion, adminPubkey)).toBe(false);
      expect(canApprovePost(regularUserPubkey, mockDiscussion, adminPubkey)).toBe(false);
      expect(canViewAuditWithNames(regularUserPubkey, mockDiscussion, adminPubkey)).toBe(false);
    });
  });

  describe('audit log display rules', () => {
    const mockProfiles = {
      [adminPubkey]: { name: '管理者' },
      [moderatorPubkey1]: { name: 'モデレーター1' },
      [creatorPubkey]: { name: '作成者' },
      [regularUserPubkey]: { name: '一般ユーザー' },
    };

    test('should show names only to authorized viewers', () => {
      // Admin viewing - should see all names
      const adminViewAdmin = getVisibleProfileInfo(adminPubkey, mockProfiles, adminPubkey, mockDiscussion, adminPubkey);
      const adminViewMod = getVisibleProfileInfo(moderatorPubkey1, mockProfiles, adminPubkey, mockDiscussion, adminPubkey);
      const adminViewCreator = getVisibleProfileInfo(creatorPubkey, mockProfiles, adminPubkey, mockDiscussion, adminPubkey);
      
      expect(adminViewAdmin.showName).toBe(true);
      expect(adminViewMod.showName).toBe(true);
      expect(adminViewCreator.showName).toBe(true);

      // Regular user viewing - should see badges only
      const userViewAdmin = getVisibleProfileInfo(adminPubkey, mockProfiles, regularUserPubkey, mockDiscussion, adminPubkey);
      const userViewMod = getVisibleProfileInfo(moderatorPubkey1, mockProfiles, regularUserPubkey, mockDiscussion, adminPubkey);
      const userViewCreator = getVisibleProfileInfo(creatorPubkey, mockProfiles, regularUserPubkey, mockDiscussion, adminPubkey);
      
      expect(userViewAdmin.showName).toBe(false);
      expect(userViewMod.showName).toBe(false);
      expect(userViewCreator.showName).toBe(false);
      
      expect(userViewAdmin.badges).toContain('モデレーター');
      expect(userViewMod.badges).toContain('モデレーター');
      expect(userViewCreator.badges).toContain('作成者');
    });
  });

  describe('permission system integration', () => {
    test('should handle complex permission scenarios', () => {
      // Admin creating their own discussion
      const adminCreatedDiscussion: Discussion = {
        ...mockDiscussion,
        authorPubkey: adminPubkey,
      };

      // Admin should have all permissions on their own discussion
      expect(isDiscussionCreator(adminPubkey, adminCreatedDiscussion)).toBe(true);
      expect(canEditDiscussion(adminPubkey, adminCreatedDiscussion, adminPubkey)).toBe(true);
      expect(canDeleteDiscussion(adminPubkey, adminCreatedDiscussion, adminPubkey)).toBe(true);
      expect(canApprovePost(adminPubkey, adminCreatedDiscussion, adminPubkey)).toBe(true);
      expect(canViewAuditWithNames(adminPubkey, adminCreatedDiscussion, adminPubkey)).toBe(true);
    });

    test('should handle discussion with creator as moderator', () => {
      const creatorAsModDiscussion: Discussion = {
        ...mockDiscussion,
        moderators: [
          ...mockDiscussion.moderators,
          { pubkey: creatorPubkey, name: '作成者兼モデレーター' },
        ],
      };

      // Creator should have creator permissions + moderator permissions
      expect(canEditDiscussion(creatorPubkey, creatorAsModDiscussion, adminPubkey)).toBe(true);
      expect(canDeleteDiscussion(creatorPubkey, creatorAsModDiscussion, adminPubkey)).toBe(true);
      expect(canApprovePost(creatorPubkey, creatorAsModDiscussion, adminPubkey)).toBe(true);
      expect(canViewAuditWithNames(creatorPubkey, creatorAsModDiscussion, adminPubkey)).toBe(true);
    });
  });

  describe('security edge cases', () => {
    test('should handle spoofed pubkeys safely', () => {
      const spoofedPubkey = adminPubkey + 'spoofed';
      
      expect(canEditDiscussion(spoofedPubkey, mockDiscussion, adminPubkey)).toBe(false);
      expect(canApprovePost(spoofedPubkey, mockDiscussion, adminPubkey)).toBe(false);
      expect(canViewAuditWithNames(spoofedPubkey, mockDiscussion, adminPubkey)).toBe(false);
    });

    test('should handle empty moderators array', () => {
      const noModsDiscussion: Discussion = {
        ...mockDiscussion,
        moderators: [],
      };

      expect(canApprovePost(moderatorPubkey1, noModsDiscussion, adminPubkey)).toBe(false);
      expect(canApprovePost(adminPubkey, noModsDiscussion, adminPubkey)).toBe(true);
      expect(canApprovePost(creatorPubkey, noModsDiscussion, adminPubkey)).toBe(true);
    });

    test('should validate pubkey format', () => {
      const invalidPubkeys = ['', 'short', 'invalid-format', null, undefined];
      
      invalidPubkeys.forEach(pubkey => {
        expect(canEditDiscussion(pubkey as any, mockDiscussion, adminPubkey)).toBe(false);
        expect(canApprovePost(pubkey as any, mockDiscussion, adminPubkey)).toBe(false);
      });
    });
  });
});