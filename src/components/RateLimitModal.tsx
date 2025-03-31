"use client";

import React, { useState, useEffect } from "react";
import SupporterRegistration from "./SupporterRegistration";
import AuthStatus from "./AuthStatus";

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
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start">
            <h2 className="text-xl font-bold text-gray-800">
              リクエスト制限に達しました
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="mt-4 mb-6">
            <div className="mb-4">
              <AuthStatus onLoginClick={() => setIsRegistering(true)} />
            </div>

            {isRegistering ? (
              <SupporterRegistration onComplete={handleRegistrationComplete} />
            ) : (
              <>
                <p className="text-gray-600 mb-3">
                  1時間あたり10リクエストの制限に達しました。以下のオプションがあります：
                </p>
                <ul className="list-disc pl-5 mb-4 text-gray-600">
                  <li className="mb-2">
                    1時間待ってから再試行する（残り時間はブラウザを閉じても継続します）
                  </li>
                  <li>
                    支援者として登録すると、リクエスト制限なしで利用できます
                  </li>
                </ul>
                <button
                  onClick={() => setIsRegistering(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  支援者として登録
                </button>
                <button
                  onClick={onClose}
                  className="w-full mt-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                >
                  閉じる
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
