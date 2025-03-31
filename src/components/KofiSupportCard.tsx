"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

const KofiSupportCard: React.FC = () => {
  return (
    <div className="mb-8 bg-white rounded-lg shadow-lg overflow-hidden max-w-3xl mx-auto">
      <Link
        href="https://ko-fi.com/nawashiro/tiers"
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/3 relative h-48 md:h-auto">
            <Image
              src="/ko-fi-image.jpg"
              alt="Ko-fi支援"
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
          <div className="p-6 md:w-2/3">
            <h3 className="text-xl font-semibold mb-3 text-primary">
              開発者を支援する
            </h3>
            <p className="text-gray-700 mb-4">
              Nawashiroは現在、労働災害で負った障害により、通常の仕事に就くことができません。貯金を切り崩して生活しています。継続的な支援があれば、活動を続けることができるかもしれません。支援をお願いします。
            </p>
            <div className="mt-2">
              <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                Ko-fiで支援する →
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default KofiSupportCard;
