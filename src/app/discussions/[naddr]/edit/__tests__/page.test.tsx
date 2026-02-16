import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DiscussionEditPage from '../page';

// Mock all the modules and hooks
jest.mock('next/navigation', () => ({
  useParams: () => ({ naddr: 'test-naddr' }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: { 
      pubkey: 'test-user-pubkey',
      isLoggedIn: true 
    },
    signEvent: jest.fn(),
  }),
}));

jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({}),
}));

jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: () => ({
    streamEventsOnEvent: jest.fn(() => jest.fn()),
    getDiscussions: jest.fn().mockResolvedValue([{
      id: 'test-event-id',
      pubkey: 'test-user-pubkey',
      tags: [['d', 'test-discussion'], ['name', 'Test Discussion']],
      content: 'Test Description',
      created_at: Math.floor(Date.now() / 1000),
    }]),
  }),
}));

jest.mock('@/lib/nostr/naddr-utils', () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: 'test-discussion',
    authorPubkey: 'test-user-pubkey',
    discussionId: 'test-id',
  }),
}));

jest.mock('@/lib/nostr/nostr-utils', () => ({
  parseDiscussionEvent: () => ({
    id: 'test-id',
    title: 'Test Discussion',
    description: 'Test Description',
    authorPubkey: 'test-user-pubkey',
    dTag: 'test-discussion',
    moderators: [],
    createdAt: Date.now() / 1000,
  }),
  isValidNpub: () => true,
  npubToHex: () => 'test-hex',
}));

jest.mock('@/components/discussion/LoginModal', () => {
  return function MockLoginModal() {
    return <div>Login Modal</div>;
  };
});

jest.mock('@/components/ui/Button', () => {
  return function MockButton({ children, disabled, loading, ...props }: any) {
    return (
      <button disabled={disabled || loading} {...props}>
        {loading ? 'Loading...' : children}
      </button>
    );
  };
});

describe.skip('DiscussionEditPage - ID Field Restrictions', () => {
  it('should not show editable ID field as per NIP-72 specification', async () => {
    render(<DiscussionEditPage />);
    
    // Wait for component to load discussion data
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should NOT have an editable ID field
    expect(screen.queryByLabelText('会話ID *')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('test-discussion')).not.toBeInTheDocument();
    
    // Should show the ID as read-only information instead
    expect(screen.getByText('test-discussion')).toBeInTheDocument();
  });

  it('should show ID as read-only display information', async () => {
    render(<DiscussionEditPage />);
    
    // Wait for component to load discussion data
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should display the ID somewhere but not as an editable field
    expect(screen.getByText('test-discussion')).toBeInTheDocument();
  });

  it('should still allow editing of title, description, and moderators', async () => {
    render(<DiscussionEditPage />);
    
    // Wait for component to load discussion data
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have editable fields for title and description
    expect(screen.getByLabelText('タイトル *')).toBeInTheDocument();
    expect(screen.getByLabelText('説明 *')).toBeInTheDocument();
    
    // Should have moderators field
    expect(screen.getByText(/モデレーター/)).toBeInTheDocument();
  });
});

describe('DiscussionEditPage - Back Link Removal', () => {
  it('does not render "会話に戻る" link', async () => {
    render(<DiscussionEditPage />);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(screen.queryByText('会話に戻る')).not.toBeInTheDocument();
    expect(screen.queryByText('← 会話に戻る')).not.toBeInTheDocument();
  });
});
