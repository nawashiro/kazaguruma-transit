/**
 * Integration tests for the complete discussion system
 * Tests the end-to-end flow from user creation to URL routing
 */

import { jest } from '@jest/globals';
import { 
  processDiscussionCreationFlow,
  type CreationFlowParams,
  type DiscussionCreationForm
} from '../user-creation-flow';
import { 
  buildNaddrFromDiscussion,
  extractDiscussionFromNaddr
} from '../../nostr/naddr-utils';
import { 
  canEditDiscussion,
  canApprovePost,
  canViewAuditWithNames,
  getVisibleProfileInfo 
} from '../permission-system';
import type { Discussion } from '../../../types/discussion';

// Mock dependencies
jest.mock('../../nostr/nostr-service');
jest.mock('../../../utils/logger');

describe('Discussion System Integration', () => {
  const mockUserPubkey = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const mockAdminPubkey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const mockModeratorPubkey = 'fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321';

  const mockSignEvent = jest.fn();
  const mockPublishEvent = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignEvent.mockResolvedValue({
      id: 'test-event-id',
      kind: 34550,
      tags: [['d', 'test-discussion']],
      content: JSON.stringify({
        title: 'Test Discussion',
        description: 'Test Description'
      }),
      created_at: Math.floor(Date.now() / 1000),
      pubkey: mockUserPubkey,
      sig: 'mock-signature',
    });
    mockPublishEvent.mockResolvedValue(true);
  });

  describe('Complete User Creation to URL Flow', () => {
    it('should successfully create discussion and generate proper naddr URL', async () => {
      // Step 1: User creates discussion
      const formData: DiscussionCreationForm = {
        title: 'New User Discussion',
        description: 'A discussion created by a regular user',
        moderators: [],
      };

      const creationParams: CreationFlowParams = {
        formData,
        userPubkey: mockUserPubkey,
        adminPubkey: mockAdminPubkey,
        signEvent: mockSignEvent,
        publishEvent: mockPublishEvent,
      };

      const result = await processDiscussionCreationFlow(creationParams);

      expect(result.success).toBe(true);
      expect(result.discussionNaddr).toBeDefined();
      expect(result.errors).toEqual([]);

      // Step 2: Build naddr from created discussion
      const mockDiscussion: Discussion = {
        id: 'test-discussion-id',
        dTag: 'test-discussion',
        title: 'New User Discussion',
        description: 'A discussion created by a regular user',
        authorPubkey: mockAdminPubkey, // Admin publishes but user creates
        creatorPubkey: mockUserPubkey, // User who requested
        moderators: [],
        createdAt: Math.floor(Date.now() / 1000),
        lastModified: Math.floor(Date.now() / 1000),
        event: {} as any,
      };

      const naddr = buildNaddrFromDiscussion(mockDiscussion);
      expect(naddr).toMatch(/^naddr1/);

      // Step 3: Extract discussion info from naddr
      const extractedInfo = extractDiscussionFromNaddr(naddr);
      expect(extractedInfo).not.toBeNull();
      expect(extractedInfo?.dTag).toBe('test-discussion');
      expect(extractedInfo?.authorPubkey).toBe(mockAdminPubkey);
      expect(extractedInfo?.discussionId).toBe(`34550:${mockAdminPubkey}:test-discussion`);

      // Step 4: Verify URL generation works
      const expectedUrl = `/discussions/${naddr}`;
      expect(expectedUrl).toContain('naddr1');
    });

    it('should handle permission checks throughout the flow', async () => {
      const mockDiscussion: Discussion = {
        id: 'test-discussion-id',
        dTag: 'test-discussion',
        title: 'Permission Test Discussion',
        description: 'Testing permission system',
        authorPubkey: mockAdminPubkey,
        creatorPubkey: mockUserPubkey,
        moderators: [{ pubkey: mockModeratorPubkey, addedAt: Date.now() }],
        createdAt: Math.floor(Date.now() / 1000),
        lastModified: Math.floor(Date.now() / 1000),
        event: {} as any,
      };

      // Test edit permission for creator (admin publishes, so creator can't edit)
      const creatorEditPermission = canEditDiscussion(mockUserPubkey, mockDiscussion, mockAdminPubkey);
      expect(creatorEditPermission).toBe(false); // Creator can't edit admin-published discussions

      // Test edit permission for admin
      const adminEditPermission = canEditDiscussion(mockAdminPubkey, mockDiscussion, mockAdminPubkey);
      expect(adminEditPermission).toBe(true);

      // Test approve permission for moderator
      const moderatorApprovePermission = canApprovePost(mockModeratorPubkey, mockDiscussion, mockAdminPubkey);
      expect(moderatorApprovePermission).toBe(true);

      // Test audit log access for admin
      const adminAuditAccess = canViewAuditWithNames(mockAdminPubkey, mockDiscussion, mockAdminPubkey);
      expect(adminAuditAccess).toBe(true);
    });

    it('should properly handle profile privacy in audit logs', () => {
      const mockProfiles = {
        [mockUserPubkey]: { name: 'Test User' },
        [mockModeratorPubkey]: { name: 'Test Moderator' },
      };

      const mockDiscussion: Discussion = {
        id: 'test-discussion-id',
        dTag: 'test-discussion',
        title: 'Privacy Test Discussion',
        description: 'Testing profile privacy',
        authorPubkey: mockAdminPubkey,
        creatorPubkey: mockUserPubkey,
        moderators: [{ pubkey: mockModeratorPubkey, addedAt: Date.now() }],
        createdAt: Math.floor(Date.now() / 1000),
        lastModified: Math.floor(Date.now() / 1000),
        event: {} as any,
      };

      // Admin should see names
      const adminView = getVisibleProfileInfo(
        mockUserPubkey,
        mockProfiles,
        mockAdminPubkey,
        mockDiscussion,
        mockAdminPubkey
      );
      expect(adminView.name).toBe('Test User');
      expect(adminView.showName).toBe(true);

      // Moderator should see names
      const moderatorView = getVisibleProfileInfo(
        mockUserPubkey,
        mockProfiles,
        mockModeratorPubkey,
        mockDiscussion,
        mockAdminPubkey
      );
      expect(moderatorView.name).toBe('Test User');
      expect(moderatorView.showName).toBe(true);

      // Regular user should not see names
      const userView = getVisibleProfileInfo(
        mockUserPubkey,
        mockProfiles,
        'regular-user-pubkey-1234567890abcdef1234567890abcdef12345678',
        mockDiscussion,
        mockAdminPubkey
      );
      expect(userView.name).toBeUndefined();
      expect(userView.showName).toBe(false);
    });
  });

  describe('naddr Round-trip Integration', () => {
    it('should maintain data integrity through encode/decode cycle', () => {
      const originalDiscussion: Discussion = {
        id: 'integration-test-id',
        dTag: 'integration-test-discussion',
        title: 'Integration Test Discussion',
        description: 'Testing naddr round-trip',
        authorPubkey: mockAdminPubkey,
        creatorPubkey: mockUserPubkey,
        moderators: [],
        createdAt: Math.floor(Date.now() / 1000),
        lastModified: Math.floor(Date.now() / 1000),
        event: {} as any,
      };

      // Encode to naddr
      const naddr = buildNaddrFromDiscussion(originalDiscussion);
      
      // Decode back
      const decodedInfo = extractDiscussionFromNaddr(naddr);
      
      // Verify data integrity
      expect(decodedInfo).not.toBeNull();
      expect(decodedInfo?.dTag).toBe(originalDiscussion.dTag);
      expect(decodedInfo?.authorPubkey).toBe(originalDiscussion.authorPubkey);
      expect(decodedInfo?.discussionId).toBe(`34550:${originalDiscussion.authorPubkey}:${originalDiscussion.dTag}`);
    });

    it('should work with URL routing patterns', () => {
      const mockDiscussion: Discussion = {
        id: 'url-test-id',
        dTag: 'url-test-discussion',
        title: 'URL Test Discussion',
        description: 'Testing URL patterns',
        authorPubkey: mockAdminPubkey,
        creatorPubkey: mockUserPubkey,
        moderators: [],
        createdAt: Math.floor(Date.now() / 1000),
        lastModified: Math.floor(Date.now() / 1000),
        event: {} as any,
      };

      const naddr = buildNaddrFromDiscussion(mockDiscussion);
      
      // Simulate Next.js routing
      const discussionUrl = `/discussions/${naddr}`;
      const approvalUrl = `/discussions/${naddr}/approve`;
      
      expect(discussionUrl).toMatch(/^\/discussions\/naddr1/);
      expect(approvalUrl).toMatch(/^\/discussions\/naddr1.*\/approve$/);
      
      // Extract naddr param (simulating useParams())
      const naddrParam = discussionUrl.split('/discussions/')[1];
      const extractedInfo = extractDiscussionFromNaddr(naddrParam);
      
      expect(extractedInfo).not.toBeNull();
      expect(extractedInfo?.dTag).toBe('url-test-discussion');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid naddr gracefully', () => {
      const invalidNaddr = 'invalid-naddr-string';
      const extractedInfo = extractDiscussionFromNaddr(invalidNaddr);
      expect(extractedInfo).toBeNull();
    });

    it('should handle creation flow errors', async () => {
      mockPublishEvent.mockResolvedValue(false);

      const formData: DiscussionCreationForm = {
        title: 'Failing Discussion',
        description: 'This should fail',
        moderators: [],
      };

      const creationParams: CreationFlowParams = {
        formData,
        userPubkey: mockUserPubkey,
        adminPubkey: mockAdminPubkey,
        signEvent: mockSignEvent,
        publishEvent: mockPublishEvent,
      };

      const result = await processDiscussionCreationFlow(creationParams);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle permission errors', () => {
      const mockDiscussion: Discussion = {
        id: 'permission-test-id',
        dTag: 'permission-test',
        title: 'Permission Test',
        description: 'Testing permissions',
        authorPubkey: mockAdminPubkey,
        creatorPubkey: mockUserPubkey,
        moderators: [],
        createdAt: Math.floor(Date.now() / 1000),
        lastModified: Math.floor(Date.now() / 1000),
        event: {} as any,
      };

      // Test unauthenticated edit permission
      const unauthEditPermission = canEditDiscussion(null, mockDiscussion, mockAdminPubkey);
      expect(unauthEditPermission).toBe(false);

      // Test unauthenticated approve permission
      const unauthApprovePermission = canApprovePost(null, mockDiscussion, mockAdminPubkey);
      expect(unauthApprovePermission).toBe(false);
    });
  });
});