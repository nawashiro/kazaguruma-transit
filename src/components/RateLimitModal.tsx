"use client";

import React from "react";

interface RateLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RateLimitModal({
  isOpen,
  onClose,
}: RateLimitModalProps) {
  // モーダル外のクリックで閉じる処理
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open" onClick={handleBackdropClick}>
      <div
        className="modal-box max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-limit-title"
      >
        <div className="flex justify-between items-start">
          <h3 id="rate-limit-title" className="font-bold text-lg">
            リクエスト制限に達しました
          </h3>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="py-4">
          <p className="mb-3">
            1時間あたり60リクエストの制限に達しました。以下のオプションがあります：
          </p>
          <ul className="list bg-base-200 w-full rounded-box mb-4">
            <li className="list-row">
              1時間待ってから再試行してください（残り時間はブラウザを閉じても継続します）
            </li>
          </ul>
          <div className="flex flex-col gap-2">
            <button
              onClick={onClose}
              className="btn btn-primary"
              aria-label="モーダルを閉じる"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
