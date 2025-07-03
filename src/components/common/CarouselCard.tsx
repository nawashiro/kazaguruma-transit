"use client";

import React, { ReactNode } from "react";

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
  return (
    <div id={id} className="carousel-item w-full">
      <div className="p-4 w-full max-w-screen-lg mx-auto">
        <div
          className={`card bg-base-100 w-full shadow-sm overflow-hidden ${className}`}
        >
          <div className="card-body">
            {title && <h2 className="card-title inline">{title}</h2>}
            {children}

            <div className="card-actions justify-between mt-4">
              <a
                href={`#${prevSlideId}`}
                className="btn btn-primary btn-circle"
                aria-label="前のスライドに移動"
              >
                ❮
              </a>
              <a
                href={`#${nextSlideId}`}
                className="btn btn-primary btn-circle"
                aria-label="次のスライドに移動"
              >
                ❯
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
