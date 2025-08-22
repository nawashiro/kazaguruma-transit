/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '@/lib/auth/auth-context';
import DiscussionCreatePage from '../page';
import { isDiscussionsEnabled } from '@/lib/config/discussion-config';
import { processDiscussionCreationFlow } from '@/lib/discussion/user-creation-flow';

// モック設定
jest.mock('@/lib/auth/auth-context');
jest.mock('@/lib/config/discussion-config');
jest.mock('@/lib/discussion/user-creation-flow');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockIsDiscussionsEnabled = isDiscussionsEnabled as jest.MockedFunction<typeof isDiscussionsEnabled>;
const mockProcessDiscussionCreationFlow = processDiscussionCreationFlow as jest.MockedFunction<typeof processDiscussionCreationFlow>;

describe('Discussion Create - dTag Input', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDiscussionsEnabled.mockReturnValue(true);
    mockUseAuth.mockReturnValue({
      user: { 
        isLoggedIn: true, 
        pubkey: 'test-pubkey' 
      },
      signEvent: jest.fn(),
    });
  });

  it('renders dTag input field', () => {
    render(<DiscussionCreatePage />);
    
    expect(screen.getByLabelText('会話ID（任意）')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例: transit-discussion-2024')).toBeInTheDocument();
  });

  it('allows entering valid dTag', async () => {
    render(<DiscussionCreatePage />);
    
    const dTagInput = screen.getByLabelText('会話ID（任意）');
    fireEvent.change(dTagInput, { target: { value: 'test-discussion-2024' } });
    
    expect(dTagInput).toHaveValue('test-discussion-2024');
  });

  it('shows character count for dTag', async () => {
    render(<DiscussionCreatePage />);
    
    const dTagInput = screen.getByLabelText('会話ID（任意）');
    fireEvent.change(dTagInput, { target: { value: 'test' } });
    
    expect(screen.getByText('4/50文字')).toBeInTheDocument();
  });

  it('validates dTag length - too short', async () => {
    render(<DiscussionCreatePage />);
    
    // 必須フィールドを埋める
    fireEvent.change(screen.getByLabelText('タイトル *'), { target: { value: 'Test Title' } });
    fireEvent.change(screen.getByLabelText('説明 *'), { target: { value: 'Test Description' } });
    fireEvent.change(screen.getByLabelText('会話ID（任意）'), { target: { value: 'ab' } }); // 2文字（短すぎる）
    
    const submitButton = screen.getByText('会話を作成する');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('IDは3文字以上50文字以内で入力してください')).toBeInTheDocument();
    });
  });

  it('validates dTag length - too long', async () => {
    render(<DiscussionCreatePage />);
    
    // 必須フィールドを埋める
    fireEvent.change(screen.getByLabelText('タイトル *'), { target: { value: 'Test Title' } });
    fireEvent.change(screen.getByLabelText('説明 *'), { target: { value: 'Test Description' } });
    fireEvent.change(screen.getByLabelText('会話ID（任意）'), { target: { value: 'a'.repeat(51) } }); // 51文字（長すぎる）
    
    const submitButton = screen.getByText('会話を作成する');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('IDは3文字以上50文字以内で入力してください')).toBeInTheDocument();
    });
  });

  it('validates dTag characters - invalid characters', async () => {
    render(<DiscussionCreatePage />);
    
    // 必須フィールドを埋める
    fireEvent.change(screen.getByLabelText('タイトル *'), { target: { value: 'Test Title' } });
    fireEvent.change(screen.getByLabelText('説明 *'), { target: { value: 'Test Description' } });
    fireEvent.change(screen.getByLabelText('会話ID（任意）'), { target: { value: 'test@invalid' } }); // 無効文字
    
    const submitButton = screen.getByText('会話を作成する');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('IDは英数字、ハイフン、アンダースコアのみ使用できます')).toBeInTheDocument();
    });
  });

  it('allows valid dTag characters', async () => {
    mockProcessDiscussionCreationFlow.mockResolvedValue({
      success: true,
      discussionNaddr: 'test-naddr',
      errors: [],
      successMessage: 'Success',
    });

    render(<DiscussionCreatePage />);
    
    // 必須フィールドを埋める
    fireEvent.change(screen.getByLabelText('タイトル *'), { target: { value: 'Test Title' } });
    fireEvent.change(screen.getByLabelText('説明 *'), { target: { value: 'Test Description' } });
    fireEvent.change(screen.getByLabelText('会話ID（任意）'), { target: { value: 'test-discussion_2024' } }); // 有効文字
    
    const submitButton = screen.getByText('会話を作成する');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockProcessDiscussionCreationFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({
            dTag: 'test-discussion_2024',
          }),
        })
      );
    });
  });

  it('passes empty dTag when not specified', async () => {
    mockProcessDiscussionCreationFlow.mockResolvedValue({
      success: true,
      discussionNaddr: 'test-naddr',
      errors: [],
      successMessage: 'Success',
    });

    render(<DiscussionCreatePage />);
    
    // 必須フィールドのみ埋める（dTagは空）
    fireEvent.change(screen.getByLabelText('タイトル *'), { target: { value: 'Test Title' } });
    fireEvent.change(screen.getByLabelText('説明 *'), { target: { value: 'Test Description' } });
    
    const submitButton = screen.getByText('会話を作成する');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockProcessDiscussionCreationFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: expect.objectContaining({
            dTag: '',
          }),
        })
      );
    });
  });
});