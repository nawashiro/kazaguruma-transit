"use client";

import React from "react";
import SupporterRegistration from "./SupporterRegistration";

interface SupporterRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupporterRegistrationModal({
  isOpen,
  onClose,
}: SupporterRegistrationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div
          className="fixed inset-0 transition-opacity bg-black bg-opacity-40"
          onClick={onClose}
          aria-hidden="true"
        ></div>

        <div className="relative z-10 w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          >
            <span className="sr-only">閉じる</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
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

          <SupporterRegistration onComplete={onClose} />
        </div>
      </div>
    </div>
  );
}
