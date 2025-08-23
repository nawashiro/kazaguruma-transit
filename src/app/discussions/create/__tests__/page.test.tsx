import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DiscussionCreatePage from '../page';

// Mock all the modules and hooks
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({}),
}));

jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: () => ({}),
}));

jest.mock('@/lib/discussion/user-creation-flow', () => ({
  processDiscussionCreationFlow: jest.fn(),
}));

jest.mock('@/lib/nostr/nostr-utils', () => ({
  getAdminPubkeyHex: () => 'admin-pubkey',
  isValidNpub: () => true,
}));

jest.mock('@/components/discussion/LoginModal', () => {
  return function MockLoginModal() {
    return <div>Login Modal</div>;
  };
});

jest.mock('@/components/ui/Button', () => {
  return function MockButton({ children, onClick, disabled, loading, ...props }: any) {
    return (
      <button onClick={onClick} disabled={disabled || loading} {...props}>
        {loading ? 'Loading...' : children}
      </button>
    );
  };
});

describe.skip('DiscussionCreatePage - ID Validation', () => {
  const mockUseAuth = jest.requireMock('@/lib/auth/auth-context').useAuth as jest.MockedFunction<any>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      user: { 
        pubkey: 'test-user-pubkey',
        isLoggedIn: true 
      },
      signEvent: jest.fn(),
    });
  });

  it('should show ID as required field', () => {
    render(<DiscussionCreatePage />);
    
    // The field label should NOT say "（任意）" (optional)
    expect(screen.getByText('会話ID *')).toBeInTheDocument();
  });

  it('should validate ID format: only lowercase alphanumeric and hyphens allowed', async () => {
    render(<DiscussionCreatePage />);
    
    const titleInput = screen.getByLabelText('タイトル *');
    const descriptionInput = screen.getByLabelText('説明 *');
    const idInput = screen.getByLabelText('会話ID *');
    const submitButton = screen.getByRole('button', { name: /会話を作成する/ });

    // Fill in required fields
    fireEvent.change(titleInput, { target: { value: 'Test Discussion' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
    
    // Test invalid characters (uppercase letters)
    fireEvent.change(idInput, { target: { value: 'Test-ID' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('IDは小文字英数字、ハイフンのみ使用できます')).toBeInTheDocument();
    });
  });

  it('should validate ID format: no underscores allowed', async () => {
    render(<DiscussionCreatePage />);
    
    const titleInput = screen.getByLabelText('タイトル *');
    const descriptionInput = screen.getByLabelText('説明 *');
    const idInput = screen.getByLabelText('会話ID *');
    const submitButton = screen.getByRole('button', { name: /会話を作成する/ });

    // Fill in required fields
    fireEvent.change(titleInput, { target: { value: 'Test Discussion' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
    
    // Test invalid characters (underscores)
    fireEvent.change(idInput, { target: { value: 'test_id' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('IDは小文字英数字、ハイフンのみ使用できます')).toBeInTheDocument();
    });
  });

  it('should accept valid ID format', async () => {
    const mockProcessDiscussionCreationFlow = jest.requireMock('@/lib/discussion/user-creation-flow').processDiscussionCreationFlow;
    mockProcessDiscussionCreationFlow.mockResolvedValue({
      success: true,
      discussionNaddr: 'test-naddr',
      errors: [],
      successMessage: 'Success',
    });

    render(<DiscussionCreatePage />);
    
    const titleInput = screen.getByLabelText('タイトル *');
    const descriptionInput = screen.getByLabelText('説明 *');
    const idInput = screen.getByLabelText('会話ID *');
    const submitButton = screen.getByRole('button', { name: /会話を作成する/ });

    // Fill in required fields with valid data
    fireEvent.change(titleInput, { target: { value: 'Test Discussion' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
    fireEvent.change(idInput, { target: { value: 'valid-test-id-123' } });
    
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockProcessDiscussionCreationFlow).toHaveBeenCalled();
    });
  });

  it('should require ID field - show error when empty', async () => {
    render(<DiscussionCreatePage />);
    
    const titleInput = screen.getByLabelText('タイトル *');
    const descriptionInput = screen.getByLabelText('説明 *');
    const submitButton = screen.getByRole('button', { name: /会話を作成する/ });

    // Fill in other required fields but leave ID empty
    fireEvent.change(titleInput, { target: { value: 'Test Discussion' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });
    
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('IDは必須です')).toBeInTheDocument();
    });
  });

  it('should show correct description text for ID field', () => {
    render(<DiscussionCreatePage />);
    
    // Should show updated description text (no mention of auto-generation)
    expect(screen.getByText('小文字英数字、ハイフンのみ使用可能')).toBeInTheDocument();
    
    // Should NOT show mention of auto-generation since it's now required
    expect(screen.queryByText(/自動生成/)).not.toBeInTheDocument();
  });
});