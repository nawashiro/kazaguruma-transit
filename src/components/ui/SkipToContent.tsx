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
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-content focus:rounded-md focus:shadow-md"
    >
      メインコンテンツにスキップ
    </a>
  );
}
