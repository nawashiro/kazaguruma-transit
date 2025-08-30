"use client";

import { useState, useEffect } from "react";

interface RubyWrapperProps {
  className?: string;
  delay?: number;
}

export default function RubyWrapper({ delay = 500 }: RubyWrapperProps) {
  const [isRubyText, setIsRubyText] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).RubyfulV2) {
      const sleep = (time: number) =>
        new Promise((resolve) => setTimeout(resolve, time));

      const rubyProcess = async () => {
        await sleep(delay);
        await setIsRubyText(true);
      };

      rubyProcess();
    }
  }, [delay]);

  return (
    isRubyText && <span className="ruby-text hidden">漢字にルビを振る</span>
  );
}
