"use client";

import React, { useState, useEffect } from "react";
import SupporterRegistration from "./SupporterRegistration";

interface RateLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RateLimitModal({
  isOpen,
  onClose,
}: RateLimitModalProps) {
  const [isRegistering, setIsRegistering] = useState(false);

  // モーダルが閉じられたら登録状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setIsRegistering(false);
    }
  }, [isOpen]);

  // モーダル外のクリックで閉じる処理
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 支援者登録完了時の処理
  const handleRegistrationComplete = () => {
    setIsRegistering(false);
    // 少し待ってからモーダルを閉じる
    setTimeout(() => {
      onClose();
      // 画面全体をリロードして状態を更新
      window.location.reload();
    }, 1000);
  };

  // 支援者モーダルを開く処理
  const handleOpenSupporterModal = () => {
    // モーダルを閉じる
    onClose();
    // 少し待ってからサポーターモーダルを開くイベントを発火
    setTimeout(() => {
      const event = new CustomEvent("open-supporter-modal");
      window.dispatchEvent(event);
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open" onClick={handleBackdropClick}>
      <div className="modal-box max-w-md">
        <div className="flex justify-between items-start">
          <h3 className="font-bold text-lg">リクエスト制限に達しました</h3>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
            ✕
          </button>
        </div>

        <div className="py-4">
          {isRegistering ? (
            <SupporterRegistration onComplete={handleRegistrationComplete} />
          ) : (
            <>
              <p className="mb-3">
                1時間あたり10リクエストの制限に達しました。以下のオプションがあります：
              </p>
              <ul className="list bg-base-200 w-full rounded-box mb-4">
                <li className="list-row">
                  1時間待ってから再試行する（残り時間はブラウザを閉じても継続します）
                </li>
                <li className="list-row">
                  支援者として登録すると、リクエスト制限なしで利用できます。
                </li>
              </ul>
              <div className="flex flex-col gap-2">
                <a
                  href="https://ko-fi.com/nawashiro/tiers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  支援します
                </a>
                <button
                  onClick={handleOpenSupporterModal}
                  className="btn btn-primary"
                >
                  私は支援者です
                </button>
                <button onClick={onClose} className="btn btn-outline">
                  閉じる
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
