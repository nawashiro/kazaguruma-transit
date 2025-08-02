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
  return (
    <section
      className={`card shadow-sm bg-base-100 ${className}`}
      data-testid={testId}
      id={id}
    >
      <div className={`card-body ${bodyClassName}`}>
        {title && <h2 className="card-title inline ruby-text">{title}</h2>}
        {children}
      </div>
    </section>
  );
}
