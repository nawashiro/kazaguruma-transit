"use client";

export default function CustomHead() {
  return (
    <>
      <meta name="format-detection" content="telephone=no" />
      <meta name="application-name" content="風ぐるま乗換案内" />
      <meta name="robots" content="index, follow" />
      <link rel="manifest" href="/manifest.json" />
      {/* ヒント・ページ切り替え時のプリフェッチヒント */}
      <link rel="prefetch" href="/beginners-guide" />
      <link rel="prefetch" href="/usage" />
    </>
  );
}
