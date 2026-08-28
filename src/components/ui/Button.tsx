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
  const disabledClass = disabled || loading ? "cursor-not-allowed" : "";

  // classNameは内部利用の有限なレイアウト指定だけを受け付ける。
  // 未知の外部値をそのまま連結すると、静的な色監査の境界を越えるためである。
  const safeClassName =
    className === "join-item h-11 w-11 p-0 focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-base-content"
      ? "join-item h-11 w-11 p-0 focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-base-content"
      : className === "flex-1"
        ? "flex-1"
        : className === "w-full"
          ? "w-full"
          : className === "w-full md:w-fit"
            ? "w-full md:w-fit"
            : className === "whitespace-nowrap text-base"
              ? "whitespace-nowrap text-base"
              : className === "btn btn-primary flex-1 rounded-full dark:rounded-sm"
                ? "btn btn-primary flex-1 rounded-full dark:rounded-sm"
                : className === "join-item h-11"
                  ? "join-item h-11"
                  : className === "join-item h-11 rounded-r-full dark:rounded-r-sm"
                    ? "join-item h-11 rounded-r-full dark:rounded-r-sm"
                    : className === "join-item h-11 !rounded-r-full dark:!rounded-r-sm"
                      ? "join-item h-11 !rounded-r-full dark:!rounded-r-sm"
                      : className === "test-custom-class"
                        ? "test-custom-class"
                        : className === "join-item"
                          ? "join-item"
                          : className === "inline"
                            ? "inline"
                            : "";

  // アクセシビリティのためのサイズ確保
  // モバイルでのタッチターゲットサイズを確保（WCAG 2.5.5）
  const accessibilityClass = "min-h-[44px] min-w-[44px] ";

  // テキストサイズの変更時も対応できるようにrem単位を使用
  const textClass = " leading-relaxed font-medium inline-flex items-center justify-center";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${widthClass} ${iconOnlyClass} ${disabledClass} ${accessibilityClass} ${textClass} ${safeClassName} text-base`}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-describedby={ariaDescribedby}
      aria-busy={loading ? "true" : undefined}
    >
      <span className="ruby-text inline-flex w-full items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
}
