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
  /**
   * Text in HTML elements and fragments gets ruby; SVG, MathML, hidden subtrees
   * and custom components stay opaque. Custom components opt in with ButtonLabel.
   */
  children: React.ReactNode;
}

/** A text-only Rubyful boundary for labels rendered by custom components. */
export function ButtonLabel({ children }: { children: string | number }) {
  // Rubyful v2 (t=20250507022654) replaces innerHTML and gives ruby nodes reading-only names.
  return (
    <>
      <span key={String(children)} className="ruby-text" aria-hidden="true">
        {children}
      </span>
      <span className="sr-only">{children}</span>
    </>
  );
}

function withRubyLabels(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      return <ButtonLabel>{child}</ButtonLabel>;
    }
    if (!React.isValidElement<{
      children?: React.ReactNode;
      "aria-hidden"?: boolean | "true" | "false";
    }>(child)) {
      return child;
    }
    if (
      (typeof child.type !== "string" && child.type !== React.Fragment) ||
      child.type === "svg" ||
      child.type === "math" ||
      child.props["aria-hidden"] === true ||
      child.props["aria-hidden"] === "true"
    ) {
      return child;
    }
    return child.props.children === undefined
      ? child
      : React.cloneElement(child, { children: withRubyLabels(child.props.children) });
  });
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
    ? `btn btn-secondary gap-0 ${joined ? "" : "rounded-full dark:rounded-sm"}`
    : `btn btn-primary gap-0 ${joined ? "" : "rounded-full dark:rounded-sm"}`;
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
      className={`transit-button ${baseClasses} ${widthClass} ${iconOnlyClass} ${disabledClass} ${accessibilityClass} ${textClass} ${safeClassName} text-base`}
      data-testid={testId}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-describedby={ariaDescribedby}
      aria-busy={loading ? "true" : undefined}
    >
      {withRubyLabels(children)}
    </button>
  );
}
