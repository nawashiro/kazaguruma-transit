"use client";

import React from "react";

export interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  testId?: string;
  id?: string;
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
  testId,
  id = "",
}: CardProps) {
  const safeClassName =
    className === "rounded-lg"
      ? "rounded-lg"
      : className === "mb-6 overflow-hidden"
        ? "mb-6 overflow-hidden"
        : className === "mb-6"
          ? "mb-6"
          : className === "mb-4 border-l-4 border-primary"
            ? "mb-4 border-l-4 border-primary"
            : className === "shadow-md"
              ? "shadow-md"
              : className === "ruby-text"
                ? "ruby-text"
                : "";
  const safeBodyClassName =
    bodyClassName === "p-4"
      ? "p-4"
      : bodyClassName === "items-center"
        ? "items-center"
        : bodyClassName === "ruby-text"
          ? "ruby-text"
          : "";

  return (
    <section
      className={`card shadow-sm bg-base-100 ${safeClassName}`}
      data-testid={testId}
      id={id}
    >
      <div className={`card-body ${safeBodyClassName}`}>
        {title && <h2 className="card-title inline ruby-text gap-0">{title}</h2>}
        {children}
      </div>
    </section>
  );
}
