# Quickstart: 監査ページのヘッダー要素レイアウト移動

**Date**: 2026-01-15
**Feature**: 001-audit-header-layout

## Overview

本ドキュメントは、開発者が機能実装を開始するための最速パスを提供します。テスト駆動開発（TDD）のアプローチに従い、テストファーストで進めます。

---

## Prerequisites

### 環境確認

```bash
# Node.js バージョン確認
node -v  # v18以上

# パッケージインストール
npm install

# TypeScript型チェック
npx tsc --noEmit  # エラーなしを確認

# テスト実行
npm test  # すべて成功を確認
```

### ブランチ確認

```bash
# 現在のブランチを確認
git branch
# * 001-audit-header-layout

# 最新の変更を pull
git pull origin 001-audit-header-layout
```

---

## Step 1: 既存実装の理解（5分）

### 確認すべきファイル

```bash
# 1. レイアウトコンポーネント（拡張対象）
cat src/components/discussion/DiscussionTabLayout.tsx

# 2. 会話詳細ページ（参照元）
cat src/app/discussions/[naddr]/page.tsx | head -280

# 3. 監査ページ（参照元）
cat src/app/discussions/[naddr]/audit/page.tsx

# 4. Nostrサービス（使用するAPI）
grep -A 20 "streamDiscussionMeta" src/lib/nostr/nostr-service.ts
```

### キーポイント

- **DiscussionTabLayout**: タブナビゲーションのみ実装済み、データ取得なし
- **page.tsx**: 502-507行目（戻るリンク）、509-511行目（タイトル）、553-557行目（説明）を削除予定
- **audit/page.tsx**: 40行目（「監査ログ」見出し）を削除予定
- **streamDiscussionMeta**: リアルタイムデータ取得のAPI

---

## Step 2: テストファースト（15分）

### テストファイルの拡張

**ファイル**: `__tests__/components/discussion/DiscussionTabLayout.test.tsx`

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { DiscussionTabLayout } from "@/components/discussion/DiscussionTabLayout";
import { createNostrService } from "@/lib/nostr/nostr-service";
import { loadTestData } from "@/lib/test/test-data-loader";

// モックの準備
jest.mock("next/navigation", () => ({
  useParams: () => ({ naddr: "naddr1test" }),
  usePathname: () => "/discussions/naddr1test"
}));

jest.mock("@/lib/nostr/nostr-service");
jest.mock("@/lib/test/test-data-loader");
jest.mock("@/lib/nostr/naddr-utils", () => ({
  extractDiscussionFromNaddr: () => ({
    discussionId: "34550:testpubkey:test",
    authorPubkey: "testpubkey",
    dTag: "test"
  })
}));

describe("DiscussionTabLayout - データ取得", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("会話データを取得してタイトル・説明を表示する", async () => {
    // Arrange
    const mockStreamDiscussionMeta = jest.fn((pubkey, dTag, options) => {
      // 即座にonEventを呼び出す
      options.onEvent([{
        id: "test-event-id",
        pubkey: "testpubkey",
        created_at: 1700000000,
        kind: 34550,
        tags: [["d", "test"]],
        content: JSON.stringify({
          title: "テスト会話",
          description: "テスト説明"
        }),
        sig: "..."
      }]);
      return jest.fn(); // cleanup 関数
    });

    (createNostrService as jest.Mock).mockReturnValue({
      streamDiscussionMeta: mockStreamDiscussionMeta
    });

    // Act
    render(
      <DiscussionTabLayout baseHref="/discussions/naddr1test">
        <div>子コンテンツ</div>
      </DiscussionTabLayout>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText("テスト会話")).toBeInTheDocument();
      expect(screen.getByText("テスト説明")).toBeInTheDocument();
    });

    expect(mockStreamDiscussionMeta).toHaveBeenCalledWith(
      "testpubkey",
      "test",
      expect.any(Object)
    );
  });

  it("ローディング中はタブと戻るリンクのみ表示", () => {
    // Arrange
    const mockStreamDiscussionMeta = jest.fn(() => {
      // データを返さない（ローディング状態を維持）
      return jest.fn();
    });

    (createNostrService as jest.Mock).mockReturnValue({
      streamDiscussionMeta: mockStreamDiscussionMeta
    });

    // Act
    render(
      <DiscussionTabLayout baseHref="/discussions/naddr1test">
        <div>子コンテンツ</div>
      </DiscussionTabLayout>
    );

    // Assert
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /会話一覧に戻る/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });

  it("エラー時もタブナビゲーションを維持", async () => {
    // Arrange
    const mockStreamDiscussionMeta = jest.fn(() => {
      throw new Error("Network error");
    });

    (createNostrService as jest.Mock).mockReturnValue({
      streamDiscussionMeta: mockStreamDiscussionMeta
    });

    // Act
    render(
      <DiscussionTabLayout baseHref="/discussions/naddr1test">
        <div>子コンテンツ</div>
      </DiscussionTabLayout>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /会話一覧に戻る/i })).toBeInTheDocument();
  });

  it("テストモードではloadTestDataを使用", async () => {
    // Arrange
    (loadTestData as jest.Mock).mockResolvedValue({
      discussion: {
        id: "test-id",
        dTag: "test",
        title: "テストモード会話",
        description: "テストモード説明",
        authorPubkey: "testpubkey",
        moderators: [],
        createdAt: 1700000000
      },
      posts: [],
      evaluations: []
    });

    // Act
    render(
      <DiscussionTabLayout baseHref="/discussions/naddr1test">
        <div>子コンテンツ</div>
      </DiscussionTabLayout>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByText("テストモード会話")).toBeInTheDocument();
    });

    expect(loadTestData).toHaveBeenCalled();
  });
});
```

### テスト実行

```bash
npm test -- DiscussionTabLayout.test.tsx

# 期待結果: すべて FAIL（まだ実装していない）
```

---

## Step 3: 実装（30分）

### 3.1 DiscussionTabLayout の拡張

**ファイル**: `src/components/discussion/DiscussionTabLayout.tsx`

```typescript
"use client";

import React, { useCallback, useRef, useState, useEffect, useMemo } from "react";
import { usePathname, useParams } from "next/navigation";
import Link from "next/link";
import { createNostrService } from "@/lib/nostr/nostr-service";
import { getNostrServiceConfig } from "@/lib/config/discussion-config";
import { parseDiscussionEvent } from "@/lib/nostr/nostr-utils";
import { extractDiscussionFromNaddr } from "@/lib/nostr/naddr-utils";
import { loadTestData, isTestMode } from "@/lib/test/test-data-loader";
import { logger } from "@/utils/logger";
import type { Discussion } from "@/types/discussion";
import type { Event } from "nostr-tools";

interface DiscussionTabLayoutProps {
  baseHref: string;
  children: React.ReactNode;
}

const nostrService = createNostrService(getNostrServiceConfig());

export function DiscussionTabLayout({
  baseHref,
  children,
}: DiscussionTabLayoutProps) {
  const pathname = usePathname();
  const params = useParams();
  const naddr = params.naddr as string;
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  // 会話データの状態
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [isDiscussionLoading, setIsDiscussionLoading] = useState(true);
  const [discussionError, setDiscussionError] = useState<string | null>(null);
  const discussionStreamCleanupRef = useRef<(() => void) | null>(null);
  const loadSequenceRef = useRef(0);

  // NADDR から discussionInfo を抽出
  const discussionInfo = useMemo(() => {
    if (!naddr) return null;
    return extractDiscussionFromNaddr(naddr);
  }, [naddr]);

  // 最新のディスカッションを選択
  const pickLatestDiscussion = useCallback((events: Event[]): Discussion | null => {
    const parsed = events
      .map(parseDiscussionEvent)
      .filter((d): d is Discussion => d !== null);

    if (parsed.length === 0) {
      return null;
    }

    return parsed.reduce((latest, current) =>
      current.createdAt > latest.createdAt ? current : latest
    );
  }, []);

  // データ取得
  const loadDiscussionData = useCallback(async () => {
    if (!discussionInfo) return;

    // 前のストリームをクリーンアップ
    discussionStreamCleanupRef.current?.();
    discussionStreamCleanupRef.current = null;

    const loadSequence = ++loadSequenceRef.current;
    setDiscussion(null);
    setIsDiscussionLoading(true);
    setDiscussionError(null);

    try {
      // テストモード判定
      if (isTestMode(discussionInfo.dTag)) {
        const testData = await loadTestData();
        if (loadSequenceRef.current !== loadSequence) return;
        setDiscussion(testData.discussion);
        setIsDiscussionLoading(false);
        return;
      }

      // ストリーム開始
      discussionStreamCleanupRef.current = nostrService.streamDiscussionMeta(
        discussionInfo.authorPubkey,
        discussionInfo.dTag,
        {
          onEvent: (events) => {
            if (loadSequenceRef.current !== loadSequence) return;
            const latest = pickLatestDiscussion(events);
            if (latest) {
              setDiscussion(latest);
              setIsDiscussionLoading(false);
            }
          },
          onEose: (events) => {
            if (loadSequenceRef.current !== loadSequence) return;
            const latest = pickLatestDiscussion(events);
            if (latest) {
              setDiscussion(latest);
            }
            setIsDiscussionLoading(false);
          }
        }
      );
    } catch (error) {
      if (loadSequenceRef.current !== loadSequence) return;
      logger.error("Failed to load discussion:", error);
      setDiscussionError("会話データの取得に失敗しました");
      setIsDiscussionLoading(false);
    }
  }, [discussionInfo, pickLatestDiscussion]);

  // データロード実行
  useEffect(() => {
    loadDiscussionData();

    return () => {
      discussionStreamCleanupRef.current?.();
      discussionStreamCleanupRef.current = null;
    };
  }, [loadDiscussionData]);

  // タブナビゲーション（既存コード）
  const normalizedBase = baseHref.replace(/\/$/, "");
  const normalizedPath = pathname.replace(/\/$/, "");

  const isMainActive =
    normalizedPath === normalizedBase ||
    normalizedPath === `${normalizedBase}/`;
  const isAuditActive = normalizedPath === `${normalizedBase}/audit`;

  const tabs = [
    {
      href: normalizedBase,
      label: "会話",
      isActive: isMainActive,
    },
    {
      href: `${normalizedBase}/audit`,
      label: "監査ログ",
      isActive: isAuditActive,
    },
  ];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      let nextIndex: number | null = null;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          break;
        case "ArrowLeft":
          e.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== null) {
        tabRefs.current[nextIndex]?.focus();
      }
    },
    [tabs.length]
  );

  return (
    <div>
      {/* 戻るリンク */}
      <div className="mb-4">
        <Link
          href="/discussions"
          className="btn btn-ghost btn-sm rounded-full dark:rounded-sm"
        >
          <span className="ruby-text">← 会話一覧に戻る</span>
        </Link>
      </div>

      {/* タイトル・説明（データ取得後のみ表示） */}
      {!isDiscussionLoading && discussion && (
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4 ruby-text">
            {discussion.title}
          </h1>
          {discussion.description.split("\n").map((line, idx) => (
            <p key={idx} className="text-gray-600 dark:text-gray-400 ruby-text">
              {line}
            </p>
          ))}
        </div>
      )}

      {/* ローディング表示 */}
      {isDiscussionLoading && (
        <div
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 ruby-text mb-8"
          role="status"
          aria-live="polite"
        >
          <div className="loading loading-spinner loading-sm" aria-hidden="true"></div>
          <span>会話情報を読み込み中...</span>
        </div>
      )}

      {/* エラー表示 */}
      {discussionError && (
        <div className="alert alert-error mb-8" role="alert">
          <span>{discussionError}</span>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => {
              setDiscussionError(null);
              loadDiscussionData();
            }}
          >
            再試行
          </button>
        </div>
      )}

      {/* タブナビゲーション（既存） */}
      <nav role="tablist" className="join mb-6" aria-label="ページナビゲーション">
        {tabs.map((tab, index) => (
          <Link
            key={tab.href}
            href={tab.href}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            className={`join-item btn min-h-[44px] min-w-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              tab.isActive ? "btn-active btn-primary" : ""
            }`}
            role="tab"
            aria-selected={tab.isActive}
            tabIndex={tab.isActive ? 0 : -1}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* 子コンテンツ */}
      {children}
    </div>
  );
}
```

### 3.2 会話詳細ページのリファクタリング

**ファイル**: `src/app/discussions/[naddr]/page.tsx`

削除する行:
- 502-507行目: 戻るリンク
- 509-511行目: タイトル
- 553-557行目: 説明

```typescript
// 削除前（502-557行目）:
return (
  <div className="container mx-auto px-4 py-8">
    <div className="mb-8">
      <Link
        href="/discussions"
        className="btn btn-ghost btn-sm rounded-full dark:rounded-sm"
      >
        <span className="ruby-text">← 会話一覧に戻る</span>
      </Link>

      <h1 className="text-3xl font-bold mb-4 ruby-text">
        {discussion.title}
      </h1>

      {/* Only show aside if user is creator or moderator */}
      {(user.pubkey === discussion.authorPubkey ||
        discussion.moderators.some((m) => m.pubkey === user.pubkey)) && (
        <aside ...>...</aside>
      )}

      {discussion.description.split("\n").map((line, idx) => (
        <p key={idx} className="text-gray-600 dark:text-gray-400 ruby-text">
          {line}
        </p>
      ))}
    </div>

// 削除後（500行目以降）:
return (
  <div className="container mx-auto px-4 py-8">
    {/* Only show aside if user is creator or moderator */}
    {(user.pubkey === discussion.authorPubkey ||
      discussion.moderators.some((m) => m.pubkey === user.pubkey)) && (
      <aside className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
        ...
      </aside>
    )}
```

### 3.3 監査ページの見出し削除

**ファイル**: `src/app/discussions/[naddr]/audit/page.tsx`

```typescript
// 削除前（38-40行目）:
return (
  <div>
    <h1 className="text-2xl font-bold mb-6 ruby-text">監査ログ</h1>
    <AuditLogSection
      ref={auditRef}
      discussionInfo={discussionInfo}
      loadDiscussionIndependently={true}
      conversationAuditMode={true}
    />
  </div>
);

// 削除後:
return (
  <AuditLogSection
    ref={auditRef}
    discussionInfo={discussionInfo}
    loadDiscussionIndependently={true}
    conversationAuditMode={true}
  />
);
```

---

## Step 4: テスト実行と修正（10分）

```bash
# テスト実行
npm test -- DiscussionTabLayout.test.tsx

# 期待結果: すべて PASS

# 全テスト実行
npm test

# 型チェック
npx tsc --noEmit

# lint
npm run lint

# ビルド
npm run build
```

---

## Step 5: 手動テスト（10分）

### ローカル開発サーバー起動

```bash
npm run dev
```

### テスト手順

1. **会話詳細ページ**: http://localhost:3000/discussions/[テストnaddr]
   - [ ] 戻るリンクがタブの上に表示
   - [ ] タイトルがタブの上に表示
   - [ ] 説明がタブの上に表示
   - [ ] 作成者/モデレーター用asideがメインコンテンツ内に表示

2. **監査ページ**: http://localhost:3000/discussions/[テストnaddr]/audit
   - [ ] 戻るリンクがタブの上に表示
   - [ ] タイトルがタブの上に表示
   - [ ] 説明がタブの上に表示
   - [ ] 「監査ログ」見出しが表示されない
   - [ ] 監査ログコンテンツが直接表示

3. **ローディング状態**:
   - [ ] ネットワークを遅くして、タブ+戻るリンクのみ表示を確認
   - [ ] データ到着後、タイトル・説明が表示

4. **エラー処理**:
   - [ ] ネットワークを切断して、エラーメッセージと再試行ボタンを確認
   - [ ] タブナビゲーションと戻るリンクが維持されることを確認

5. **テストモード**: http://localhost:3000/discussions/[テストnaddr with dTag=test]
   - [ ] テストデータが表示

---

## Step 6: コミット（5分）

```bash
# すべてのテストが成功することを確認
npm test
npx tsc --noEmit
npm run lint
npm run build

# ステージング
git add src/components/discussion/DiscussionTabLayout.tsx
git add src/app/discussions/[naddr]/page.tsx
git add src/app/discussions/[naddr]/audit/page.tsx
git add __tests__/components/discussion/DiscussionTabLayout.test.tsx

# コミット
git commit -m "$(cat <<'EOF'
feat: レイアウトにヘッダー要素を移動

- DiscussionTabLayout に会話データ取得ロジックを追加
- streamDiscussionMeta によるリアルタイム更新
- 段階的ローディング（タブ+戻るリンク → タイトル+説明）
- エラー時もタブナビゲーションを維持
- テストモード対応

- page.tsx から戻るリンク・タイトル・説明を削除
- audit/page.tsx から「監査ログ」見出しを削除

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Troubleshooting

### テストが失敗する

**問題**: モックが正しく設定されていない

**解決策**:
```bash
# モックの確認
grep -n "jest.mock" __tests__/components/discussion/DiscussionTabLayout.test.tsx

# モックのクリア
jest.clearAllMocks()
```

### ローディング状態が表示されない

**問題**: `isDiscussionLoading` が即座に false になる

**解決策**:
- `streamDiscussionMeta` のモックが即座に `onEvent` を呼び出している
- 実際の動作では数百ミリ秒の遅延がある
- 手動テストで確認

### 型エラーが発生する

**問題**: `Discussion` 型の不一致

**解決策**:
```bash
# 型定義を確認
cat src/types/discussion.ts | grep -A 10 "interface Discussion"

# 型チェック
npx tsc --noEmit --pretty
```

---

## Next Steps

実装が完了したら:

1. `/speckit.tasks` を実行してタスクリストを生成
2. PRを作成してレビュー依頼
3. CI/CDでのテスト結果を確認

---

## Summary

本クイックスタートに従えば、約1時間で実装が完了します：

- **5分**: 既存実装の理解
- **15分**: テストファースト
- **30分**: 実装
- **10分**: テスト実行と修正
- **10分**: 手動テスト
- **5分**: コミット

**合計**: 約75分
