"use client";

import { useState, useEffect, useRef, ReactNode } from "react";

interface RubyWrapperProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export default function RubyWrapper({
  children,
  delay = 100,
}: RubyWrapperProps) {
  const [isRubyProcessed, setIsRubyProcessed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && !isRubyProcessed) {
      if (typeof window !== "undefined" && (window as any).RubyfulV2) {
        const sleep = (time: number) =>
          new Promise((resolve) => setTimeout(resolve, time));

        const rubyProcess = async (current: HTMLDivElement) => {
          const rubyElements = current.querySelectorAll(".ruby-text");
          for (let i = 0; i < rubyElements.length; i++) {
            await (window as any).RubyfulV2.processElement(rubyElements[i]);
            await sleep(delay);
          }
          setIsRubyProcessed(true);
        };

        rubyProcess(containerRef.current);
      }
    }
  }, [delay, isRubyProcessed]);

  return (
    <div ref={containerRef} className={`${!isRubyProcessed ? "rtHidden" : ""}`}>
      {children}
    </div>
  );
}
