"use client";

import React, { useEffect, useRef } from "react";

interface RateLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RateLimitModal({
  isOpen,
  onClose,
}: RateLimitModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // モーダルを開いたとき、閉じるボタンにフォーカスを移動
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

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
        aria-describedby="rate-limit-description"
      >
        <div className="flex justify-between items-start">
          <h3 id="rate-limit-title" className="font-bold text-lg ">
            リクエスト制限に達しました
          </h3>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost"
            aria-label="閉じる"
            data-testid="x-close-btn"
          >
            ✕
          </button>
        </div>

        <div className="py-4">
          <p id="rate-limit-description" className="mb-3 ">
            1時間あたり60リクエストの制限に達しました。以下のオプションがあります：
          </p>
          <ul className="list bg-base-100 w-full rounded-box mb-4" role="list">
            <li className="list-row ">
              1時間待ってから再試行してください（残り時間はブラウザを閉じても継続します）
            </li>
          </ul>
          <div className="flex flex-col gap-2">
            <button
              onClick={onClose}
              className="btn btn-primary rounded-full dark:rounded-sm"
              data-testid="primary-close-btn"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
