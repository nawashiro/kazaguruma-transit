"use client";

/**
 * メインコンテンツにスキップするためのアクセシビリティ機能
 * スクリーンリーダーユーザーやキーボードユーザーが
 * ナビゲーションをスキップしてメインコンテンツに直接移動できるようにする
 */
export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:static focus:block focus:p-4 focus:bg-primary focus:text-primary-content focus:rounded-md focus:shadow-md"
    >
      メインコンテンツにスキップ
    </a>
  );
}
