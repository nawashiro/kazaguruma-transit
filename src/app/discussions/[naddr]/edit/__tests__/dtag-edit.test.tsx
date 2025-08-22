/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '@/lib/auth/auth-context';
import DiscussionEditPage from '../page';
import { isDiscussionsEnabled } from '@/lib/config/discussion-config';

// モック設定
jest.mock('@/lib/auth/auth-context');
jest.mock('@/lib/config/discussion-config');
jest.mock('next/navigation', () => ({
  useParams: () => ({ naddr: 'test-naddr' }),
  useRouter: () => ({
    push: jest.fn(),
  }),
}));
jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: () => ({
    getDiscussions: jest.fn().mockResolvedValue([{
      kind: 34550,
      tags: [
        ['d', 'existing-dtag'],
        ['name', 'Existing Title'],
        ['description', 'Existing Description'],
      ],
      content: 'Existing Description',
      pubkey: 'author-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      id: 'event-id',
    }]),
    publishSignedEvent: jest.fn().mockResolvedValue(true),
  }),
}));
jest.mock('@/lib/nostr/naddr-utils', () => ({
  extractDiscussionFromNaddr: () => ({
    dTag: 'existing-dtag',
    discussionId: 'test-id',
    authorPubkey: 'author-pubkey',
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockIsDiscussionsEnabled = isDiscussionsEnabled as jest.MockedFunction<typeof isDiscussionsEnabled>;

describe('Discussion Edit - dTag Input', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDiscussionsEnabled.mockReturnValue(true);
    mockUseAuth.mockReturnValue({
      user: { 
        isLoggedIn: true, 
        pubkey: 'author-pubkey' 
      },
      signEvent: jest.fn().mockResolvedValue({
        id: 'signed-event-id',
        kind: 34550,
        content: 'Test Content',
        tags: [['d', 'test-dtag']],
        pubkey: 'author-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        sig: 'signature',
      }),
    });
  });

  it('renders dTag input field with existing value', async () => {
    render(<DiscussionEditPage />);
    
    // 既存のdTagが読み込まれるのを待つ
    await waitFor(() => {
      const dTagInput = screen.getByLabelText('会話ID *');
      expect(dTagInput).toBeInTheDocument();
      expect(dTagInput).toHaveValue('existing-dtag');
    });
  });

  it('shows character count for dTag', async () => {
    render(<DiscussionEditPage />);
    
    await waitFor(() => {
      // 'existing-dtag' は12文字
      expect(screen.getByText('12/50文字')).toBeInTheDocument();
    });
  });

  it('allows editing dTag', async () => {
    render(<DiscussionEditPage />);
    
    await waitFor(() => {
      const dTagInput = screen.getByLabelText('会話ID *');
      expect(dTagInput).toHaveValue('existing-dtag');
    });

    const dTagInput = screen.getByLabelText('会話ID *');
    await user.clear(dTagInput);
    await user.type(dTagInput, 'new-dtag-2024');
    
    expect(dTagInput).toHaveValue('new-dtag-2024');
  });

  it('validates required dTag in edit mode', async () => {
    render(<DiscussionEditPage />);
    
    await waitFor(() => {
      const dTagInput = screen.getByLabelText('会話ID *');
      expect(dTagInput).toHaveValue('existing-dtag');
    });

    const dTagInput = screen.getByLabelText('会話ID *');
    await user.clear(dTagInput); // dTagを空にする
    
    const saveButton = screen.getByText('変更を保存');
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('IDは必須です')).toBeInTheDocument();
    });
  });

  it('validates dTag length in edit mode', async () => {
    render(<DiscussionEditPage />);
    
    await waitFor(() => {
      const dTagInput = screen.getByLabelText('会話ID *');
      expect(dTagInput).toHaveValue('existing-dtag');
    });

    const dTagInput = screen.getByLabelText('会話ID *');
    await user.clear(dTagInput);
    await user.type(dTagInput, 'ab'); // 短すぎる
    
    const saveButton = screen.getByText('変更を保存');
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('IDは3文字以上50文字以内で入力してください')).toBeInTheDocument();
    });
  });

  it('validates dTag characters in edit mode', async () => {
    render(<DiscussionEditPage />);
    
    await waitFor(() => {
      const dTagInput = screen.getByLabelText('会話ID *');
      expect(dTagInput).toHaveValue('existing-dtag');
    });

    const dTagInput = screen.getByLabelText('会話ID *');
    await user.clear(dTagInput);
    await user.type(dTagInput, 'invalid@dtag'); // 無効文字
    
    const saveButton = screen.getByText('変更を保存');
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('IDは英数字、ハイフン、アンダースコアのみ使用できます')).toBeInTheDocument();
    });
  });

  it('disables save button when dTag is empty', async () => {
    render(<DiscussionEditPage />);
    
    await waitFor(() => {
      const dTagInput = screen.getByLabelText('会話ID *');
      expect(dTagInput).toHaveValue('existing-dtag');
    });

    const dTagInput = screen.getByLabelText('会話ID *');
    await user.clear(dTagInput);
    
    const saveButton = screen.getByText('変更を保存');
    expect(saveButton).toBeDisabled();
  });
});