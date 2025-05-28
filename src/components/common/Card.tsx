"use client";

import React from "react";

export interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  titleClassName?: string;
  testId?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "default" | "primary" | "secondary" | "accent" | "neutral";
}

/**
 * 再利用可能なカードコンポーネント
 * DaisyUI 5のカードコンポーネントを使用
 */
export default function Card({
  title,
  children,
  className = "",
  bodyClassName = "",
  titleClassName = "",
  testId,
  size,
  variant = "default",
}: CardProps) {
  // ベースとなるカードのクラス
  let cardClasses = "card";

  // サイズに応じたクラスを追加
  if (size) {
    cardClasses += ` card-${size}`;
  }

  // バリアントに応じたクラスを追加
  if (variant === "primary") {
    cardClasses += " bg-primary text-primary-content";
  } else if (variant === "secondary") {
    cardClasses += " bg-secondary text-secondary-content";
  } else if (variant === "accent") {
    cardClasses += " bg-accent text-accent-content";
  } else if (variant === "neutral") {
    cardClasses += " bg-neutral text-neutral-content";
  } else {
    // デフォルトは bg-base-100
    cardClasses += " bg-base-100";
  }

  // ユーザー指定のクラスを追加
  cardClasses += ` ${className}`;

  return (
    <section className={`shadow-sm ${cardClasses}`} data-testid={testId}>
      <div className={`card-body ${bodyClassName}`}>
        {title && <h2 className={`card-title ${titleClassName}`}>{title}</h2>}
        {children}
      </div>
    </section>
  );
}
