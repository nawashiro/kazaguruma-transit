"use client";

import { logger } from "@/utils/logger";
import { useState, useEffect } from "react";

interface RubyWrapperProps {
  className?: string;
  delay?: number;
  observe?: any;
}

export default function RubyWrapper({
  delay = 500,
  observe = [],
}: RubyWrapperProps) {
  const [isRubyText, setIsRubyText] = useState(false);

  useEffect(() => {
    logger.log("RubyWrapper実行");
    if (typeof window !== "undefined" && (window as any).RubyfulV2) {
      const sleep = (time: number) =>
        new Promise((resolve) => setTimeout(resolve, time));

      const rubyProcess = async () => {
        setIsRubyText(false);
        await sleep(delay);
        setIsRubyText(true);
      };

      rubyProcess();
    }
  }, [...observe, delay]);

  return (
    isRubyText && <span className="ruby-text hidden">漢字にルビを振る</span>
  );
}
