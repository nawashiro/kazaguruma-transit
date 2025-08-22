/**
 * 会話作成フロー テスト - spec_v2.md 準拠
 * 3ステップフロー、フレンドリーな口調、リクエスト機能のテスト
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth } from '@/lib/auth/auth-context';
import CreateDiscussionPage from '../page';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/config/discussion-config', () => ({
  isDiscussionsEnabled: () => true,
  getNostrServiceConfig: () => ({ relays: ['wss://test-relay.com'] }),
  getAdminPubkeyHex: () => 'admin-pubkey-hex',
}));

jest.mock('@/lib/nostr/nostr-service', () => ({
  createNostrService: jest.fn(() => ({
    createDiscussionEvent: jest.fn(),
    createDiscussionRequestEvent: jest.fn(),
    publishSignedEvent: jest.fn(),
  })),
}));

jest.mock('@/lib/nostr/naddr-utils', () => ({
  buildNaddrFromDiscussion: jest.fn((discussion) => `naddr1${discussion.dTag}`),
  generateDiscussionId: jest.fn(() => 'generated-id-123'),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockAuthLoggedIn = {
  user: {
    isLoggedIn: true,
    pubkey: 'user-pubkey-hex',
    profile: { name: 'テストユーザー' },
  },
  signEvent: jest.fn(),
  logout: jest.fn(),
  isLoading: false,
  error: null,
};

const mockAuthLoggedOut = {
  user: {
    isLoggedIn: false,
    pubkey: null,
    profile: null,
  },
  signEvent: null,
  logout: jest.fn(),
  isLoading: false,
  error: null,
};

describe('会話作成フロー - spec_v2.md準拠', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基本機能表示', () => {
    test('会話作成ページが正しく表示される', () => {
      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedIn);
      
      render(<CreateDiscussionPage />);
      
      // ページタイトルの確認
      expect(screen.getByText('会話を作成')).toBeInTheDocument();
      expect(screen.getByText('← 会話一覧に戻る')).toBeInTheDocument();
    });

    test('フォーム要素が適切に表示される', () => {
      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedIn);
      
      render(<CreateDiscussionPage />);
      
      // フォーム要素の確認
      expect(screen.getByText('タイトル')).toBeInTheDocument();
      expect(screen.getByText('説明')).toBeInTheDocument();
      expect(screen.getByText('モデレーター（任意）')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /会話を作成/ })).toBeInTheDocument();
    });
  });

  describe('入力フォーム', () => {
    test('入力フィールドの基本機能', () => {
      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedIn);
      
      render(<CreateDiscussionPage />);
      
      // 入力フィールドの存在確認
      const inputs = screen.getAllByRole('textbox');
      expect(inputs.length).toBeGreaterThanOrEqual(2); // タイトル、説明、モデレーター
      
      // 文字数カウンター確認
      expect(screen.getByText('/100文字')).toBeInTheDocument(); // タイトル
      expect(screen.getByText('/500文字')).toBeInTheDocument(); // 説明
    });

    test('入力値の更新と表示', async () => {
      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedIn);
      
      render(<CreateDiscussionPage />);
      
      // 最初の textbox（タイトル）を取得
      const inputs = screen.getAllByRole('textbox');
      const titleInput = inputs[0];
      const descriptionInput = inputs[1];
      
      fireEvent.change(titleInput, { target: { value: 'テスト会話' } });
      fireEvent.change(descriptionInput, { target: { value: 'テスト説明' } });
      
      expect(titleInput).toHaveValue('テスト会話');
      expect(descriptionInput).toHaveValue('テスト説明');
      
      // 文字数カウンターの更新確認
      expect(screen.getByText('4/100文字')).toBeInTheDocument();
      expect(screen.getByText('4/500文字')).toBeInTheDocument();
    });

    test('作成ボタンの状態', () => {
      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedIn);
      
      render(<CreateDiscussionPage />);
      
      const createButton = screen.getByRole('button', { name: /会話を作成/ });
      expect(createButton).toBeInTheDocument();
      expect(createButton).not.toBeDisabled(); // ボタンは常に有効（バリデーションはクリック時）
    });
  });

  describe('会話作成処理', () => {
    test('未ログイン時は適切にハンドリングされる', () => {
      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedOut);
      
      render(<CreateDiscussionPage />);
      
      const titleInput = screen.getByRole('textbox', { name: /タイトル/ });
      const descriptionInput = screen.getByRole('textbox', { name: /説明/ });
      
      fireEvent.change(titleInput, { target: { value: 'テスト会話' } });
      fireEvent.change(descriptionInput, { target: { value: 'テスト用の説明です' } });
      
      const createButton = screen.getByRole('button', { name: /会話を作成/ });
      fireEvent.click(createButton);
      
      // ログインモーダルが表示される
      expect(screen.getByText(/ログインが必要/)).toBeInTheDocument();
    });

    test('バリデーションエラーが適切に表示される', async () => {
      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedIn);

      render(<CreateDiscussionPage />);
      
      // 空のフォームで送信
      const createButton = screen.getByRole('button', { name: /会話を作成/ });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(screen.getByText(/タイトルは必須/)).toBeInTheDocument();
        expect(screen.getByText(/説明は必須/)).toBeInTheDocument();
      });
    });

    test('作成処理が実行される', async () => {
      const mockProcessFlow = jest.fn().mockResolvedValue({
        success: true,
        naddr: 'naddr1test123',
        message: '会話が作成されました',
      });

      // processDiscussionCreationFlow をモック
      jest.doMock('@/lib/discussion/user-creation-flow', () => ({
        processDiscussionCreationFlow: mockProcessFlow,
      }));

      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedIn);

      render(<CreateDiscussionPage />);
      
      const titleInput = screen.getByRole('textbox', { name: /タイトル/ });
      const descriptionInput = screen.getByRole('textbox', { name: /説明/ });
      
      fireEvent.change(titleInput, { target: { value: 'テスト会話' } });
      fireEvent.change(descriptionInput, { target: { value: 'テスト用の説明です' } });
      
      const createButton = screen.getByRole('button', { name: /会話を作成/ });
      fireEvent.click(createButton);
      
      await waitFor(() => {
        expect(mockProcessFlow).toHaveBeenCalled();
      });
    });
  });

  describe('アクセシビリティとUX', () => {
    test('モデレーター入力フィールドが表示される', () => {
      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedIn);
      
      render(<CreateDiscussionPage />);
      
      expect(screen.getByText(/モデレーター/)).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /moderators/ })).toBeInTheDocument();
    });

    test('ページがアクセシブルな構造になっている', () => {
      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedIn);
      
      render(<CreateDiscussionPage />);
      
      // 見出しとフォーム要素の確認
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /会話を作成/ })).toBeInTheDocument();
    });

    test('戻るリンクが正しく設定されている', () => {
      (useAuth as jest.Mock).mockReturnValue(mockAuthLoggedIn);
      
      render(<CreateDiscussionPage />);
      
      const backLink = screen.getByRole('link', { name: /会話一覧に戻る/ });
      expect(backLink).toHaveAttribute('href', '/discussions');
    });
  });
});