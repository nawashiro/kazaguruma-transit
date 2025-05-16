"use client";

import { logger } from "@/utils/logger";
import React from "react";

interface ButtonProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  fullWidth?: boolean;
  secondary?: boolean;
  testId?: string;
  "aria-label"?: string;
  "aria-pressed"?: boolean;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  "aria-describedby"?: string;
  iconOnly?: boolean;
  children: React.ReactNode;
}

export default function Button({
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  className = "",
  fullWidth = false,
  secondary = false,
  testId,
  "aria-label": ariaLabel,
  "aria-pressed": ariaPressed,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  "aria-describedby": ariaDescribedby,
  iconOnly = false,
  children,
}: ButtonProps) {
  const baseClasses = secondary
    ? "btn bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 px-6 py-2 rounded-lg shadow-sm transition-all duration-200"
    : "btn bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 px-6 py-2 rounded-lg shadow-md transition-all duration-200";
  const widthClass = fullWidth ? "w-full" : "";
  const disabledClass =
    disabled || loading ? "opacity-70 cursor-not-allowed" : "";
  const accessibilityClass = "min-h-[44px] min-w-[44px]";

  // アイコンのみボタンの場合、aria-labelが必須
  if (iconOnly && !ariaLabel) {
    logger.warn("アイコンのみのボタンにはaria-label属性が必要です");
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${widthClass} ${disabledClass} ${accessibilityClass} ${className}`}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-describedby={ariaDescribedby}
      aria-busy={loading ? "true" : undefined}
    >
      {loading ? (
        <>
          <span className="loading loading-spinner" aria-hidden="true"></span>
          <span className="sr-only">読み込み中...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
