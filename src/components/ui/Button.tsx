"use client";

import React from "react";

interface ButtonProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  fullWidth?: boolean;
  secondary?: boolean;
  joined?: boolean;
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
  joined = false,
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
    ? `btn btn-secondary ${joined ? "" : "rounded-full dark:rounded-sm"}`
    : `btn btn-primary ${joined ? "" : "rounded-full dark:rounded-sm"}`;
  const widthClass = fullWidth ? "w-full" : "";
  const iconOnlyClass = iconOnly ? "aspect-square p-0" : "";
  const disabledClass =
    disabled || loading ? "opacity-70 cursor-not-allowed" : "";

  // アクセシビリティのためのサイズ確保
  // モバイルでのタッチターゲットサイズを確保（WCAG 2.5.5）
  const accessibilityClass = "min-h-[44px] min-w-[44px] ";

  // テキストサイズの変更時も対応できるようにrem単位を使用
  const textClass = " leading-relaxed font-medium";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${widthClass} ${iconOnlyClass} ${disabledClass} ${accessibilityClass} ${textClass} ${className}`}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-describedby={ariaDescribedby}
      aria-busy={loading ? "true" : undefined}
    >
      <span className="ruby-text">{children}</span>
    </button>
  );
}
