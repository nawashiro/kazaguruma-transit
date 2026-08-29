"use client";

import React, { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface CarouselCardProps {
  id: string;
  title?: string;
  children: ReactNode;
  prevSlideId: string;
  nextSlideId: string;
  className?: string;
}

/**
 * カルーセル内で使用する再利用可能なカードコンポーネント
 * DaisyUI 5のカードおよびカルーセルコンポーネントを使用
 */
export default function CarouselCard({
  id,
  title,
  children,
  prevSlideId,
  nextSlideId,
  className = "",
}: CarouselCardProps) {
  const safeClassName =
    className === "rounded-lg"
      ? "rounded-lg"
      : className === "mb-6"
        ? "mb-6"
        : className === "shadow-md"
          ? "shadow-md"
          : "";

  return (
    <div id={id} className="carousel-item w-full">
      <div
        className={`card bg-base-100 w-full shadow-sm overflow-hidden ${safeClassName}`}
      >
        <div className="card-body ruby-text">
          {title && <h2 className="card-title inline gap-0">{title}</h2>}
          {children}
          <div className="card-actions justify-between mt-4">
            <a
              href={`#${prevSlideId}`}
              className="btn gap-0 text-base btn-primary btn-circle"
              aria-label="前のスライド"
            >
              <ArrowLeft height="1rem" width="1rem" aria-hidden="true" />
            </a>
            <a
              href={`#${nextSlideId}`}
              className="btn gap-0 text-base btn-primary btn-circle"
              aria-label="次のスライド"
            >
              <ArrowRight height="1rem" width="1rem" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
