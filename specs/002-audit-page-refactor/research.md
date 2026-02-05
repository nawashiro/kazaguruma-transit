# Research: 監査ページリファクタリング

**Feature**: 001-audit-page-refactor
**Date**: 2026-01-14

## 調査項目

1. Next.js 15 App RouterでのURL別タブナビゲーションの実装パターン
2. アクセシブルなタブナビゲーションのベストプラクティス（WCAG 2.1 AA）
3. 現在のURLパスに基づくアクティブタブの判定方法

---

## 1. タブナビゲーションの実装パターン

### 現状の実装

現在の`/discussions`と`/discussions/[naddr]`ページでは、**state-based tabs**（クライアントサイドトグル）を使用：
- `useState("main" | "audit")`でタブ状態を管理
- タブ切り替えでURLは変わらない
- 監査ログは`activeTab`状態に基づいて条件付きレンダリング

### 検討したアプローチ

| アプローチ | 長所 | 短所 |
|-----------|------|------|
| **Parallel Routes (@slotName)** | 洗練されたURL構造、スロットが状態を維持 | ファイル構造が複雑、`default.tsx`が必要 |
| **Nested Routes + 共通コンポーネント** | シンプル、理解しやすい、漸進的移行可能 | 各ページで手動コンポーネント配置が必要 |
| **Query Parameter** | 現在のURL構造を維持 | 直感的でない、ブックマークに課題 |

### Decision: Nested Routes + 共通コンポーネント

**選択理由**:
1. 現在のデータ読み込みがメインと監査で独立しているため、Parallel Routesの利点が限定的
2. ファイル構造がシンプルで保守しやすい
3. 既存コードからの漸進的移行が容易
4. URLがコンテンツを明確に反映（`/audit`で監査ページ）

### 実装パターン

```
src/app/discussions/
├── layout.tsx                  # 既存
├── page.tsx                    # 会話一覧（メイン）
├── audit/
│   └── page.tsx               # 会話一覧（監査）
└── [naddr]/
    ├── layout.tsx             # タブナビゲーションを含む
    ├── page.tsx               # 会話詳細（メイン）
    └── audit/
        └── page.tsx           # 会話詳細（監査）
```

**タブナビゲーションコンポーネント**:
```typescript
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function DiscussionTabNav({ baseHref }: { baseHref: string }) {
  const pathname = usePathname();

  const isMainActive = pathname === baseHref || pathname === `${baseHref}/`;
  const isAuditActive = pathname === `${baseHref}/audit`;

  return (
    <nav role="tablist" className="join mb-6">
      <Link
        href={baseHref}
        className={`join-item btn ${isMainActive ? 'btn-active btn-primary' : ''}`}
        role="tab"
        aria-selected={isMainActive}
      >
        会話
      </Link>
      <Link
        href={`${baseHref}/audit`}
        className={`join-item btn ${isAuditActive ? 'btn-active btn-primary' : ''}`}
        role="tab"
        aria-selected={isAuditActive}
      >
        監査ログ
      </Link>
    </nav>
  );
}
```

---

## 2. アクセシビリティ要件（WCAG 2.1 AA）

### 現状の準拠状況

既存実装はほぼ準拠済み：
- `role="tablist"`, `role="tab"`, `aria-selected`属性を使用
- キーボードアクセス可能

### 追加実装が必要な項目

#### キーボードナビゲーション（2.1.1, 2.1.2）

**Arrow Keysでのタブ間移動**:
```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const tabLinks = document.querySelectorAll('[role="tab"]');
    const currentIndex = Array.from(tabLinks).findIndex(
      el => el.getAttribute('aria-selected') === 'true'
    );

    let nextIndex: number;
    if (e.key === 'ArrowLeft') {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : tabLinks.length - 1;
    } else {
      nextIndex = currentIndex < tabLinks.length - 1 ? currentIndex + 1 : 0;
    }

    (tabLinks[nextIndex] as HTMLElement).focus();
  }

  if (e.key === 'Home') {
    e.preventDefault();
    (document.querySelector('[role="tab"]') as HTMLElement)?.focus();
  } else if (e.key === 'End') {
    e.preventDefault();
    const tabLinks = document.querySelectorAll('[role="tab"]');
    (tabLinks[tabLinks.length - 1] as HTMLElement)?.focus();
  }
};
```

#### フォーカス管理（2.4.3, 2.4.7）

**必須CSS**:
```css
[role="tab"]:focus-visible {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}
```

#### タッチターゲットサイズ（2.5.5）

**最小44px×44px**:
```css
.join-item.btn {
  min-height: 44px;
  min-width: 44px;
}
```

### Decision: 既存パターンを拡張

既存のDaisyUI `join`クラスを使用し、アクセシビリティ属性を追加：
- Arrow/Home/Endキーのハンドリング
- フォーカスインジケーターの強化
- 最小タッチターゲットサイズの確保

---

## 3. アクティブタブの判定

### 推奨パターン: usePathname()

Next.js App Routerの`usePathname()`フックを使用：

```typescript
'use client';

import { usePathname } from 'next/navigation';

export function useActiveTab(baseHref: string) {
  const pathname = usePathname();

  // 監査タブはパスが/auditで終わる場合
  const isAuditActive = pathname.endsWith('/audit');

  // メインタブはそれ以外（baseHrefと一致または/で終わる）
  const isMainActive = !isAuditActive && (
    pathname === baseHref ||
    pathname === `${baseHref}/`
  );

  return { isMainActive, isAuditActive };
}
```

### 動的ルートの対応

`/discussions/[naddr]`の場合、`baseHref`は動的に構築：

```typescript
// 会話詳細ページ
const params = useParams();
const naddr = params.naddr as string;
const baseHref = `/discussions/${naddr}`;

// タブナビゲーション
<DiscussionTabNav baseHref={baseHref} />
```

### Decision: usePathname()ベースの判定

- シンプルで堅牢
- 動的ルートにも対応
- ブラウザのBack/Forwardボタンで自動的に更新

---

## Alternatives Considered

### 1. React Router風のActiveLink

**却下理由**: Next.js App Routerには`usePathname()`という公式のソリューションがあり、追加ライブラリは不要

### 2. Context APIでタブ状態を共有

**却下理由**: URLベースのタブでは不要。URLが唯一の真実の源（Single Source of Truth）

### 3. Route Groupsを使った構造

**却下理由**: `(group)`フォルダはURLに影響しないため、このユースケースでは利点がない

---

## 結論

| 調査項目 | Decision | Rationale |
|----------|----------|-----------|
| タブ実装パターン | Nested Routes + 共通コンポーネント | シンプル、漸進的移行可能 |
| アクティブタブ判定 | `usePathname()` | Next.js公式パターン |
| アクセシビリティ | 既存パターン拡張 + キーボードNav追加 | WCAG 2.1 AA準拠 |

---

## References

- [Next.js App Router - usePathname Hook](https://nextjs.org/docs/app/api-reference/functions/use-pathname)
- [W3C WCAG 2.1 Guidelines](https://www.w3.org/TR/WCAG21/)
- [A11y Collective - Building Accessible Tab Interfaces](https://www.a11y-collective.com/blog/accessibility-tab/)
