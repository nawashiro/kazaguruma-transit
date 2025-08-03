"use client";

import { logger } from "@/utils/logger";
import React, { useId } from "react";

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
  // アクセシビリティのためのIDを生成
  const buttonId = useId();

  // 高コントラストのカラーパレットを使用
  const baseClasses = secondary
    ? "btn btn-secondary rounded-full dark:rounded-sm"
    : "btn btn-primary rounded-full dark:rounded-sm";
  const widthClass = fullWidth ? "w-full" : "";
  const disabledClass =
    disabled || loading ? "opacity-70 cursor-not-allowed" : "";

  // アクセシビリティのためのサイズ確保
  // モバイルでのタッチターゲットサイズを確保（WCAG 2.5.5）
  const accessibilityClass = "min-h-[44px] min-w-[44px] ";

  // テキストサイズの変更時も対応できるようにrem単位を使用
  const textClass = " leading-relaxed font-medium";

  // アイコンのみボタンの場合、aria-labelが必須
  if (iconOnly && !ariaLabel) {
    logger.warn("アイコンのみのボタンにはaria-label属性が必要です");
  }

  return (
    <button
      id={buttonId}
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${widthClass} ${disabledClass} ${accessibilityClass} ${textClass} ${className} ruby-text`}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-describedby={ariaDescribedby}
      aria-busy={loading ? "true" : undefined}
      // フォーカス表示を明確にするための高コントラストアウトライン
      style={{
        outline: "none",
        boxShadow: "none",
      }}
    >
      {children}
    </button>
  );
}
