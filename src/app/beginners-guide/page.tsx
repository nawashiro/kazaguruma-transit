"use client";

import Link from "next/link";
import KofiSupportCard from "../../components/KofiSupportCard";

export default function BeginnersGuide() {
  return (
    <div className="container mx-auto p-4 min-h-screen">
      <header className="text-center my-8">
        <h1 className="text-3xl font-bold text-primary bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">
          風ぐるまは初めて？
        </h1>
        <p className="mt-2 text-lg">ビギナーズガイド</p>
      </header>

      <KofiSupportCard />

      <div className="max-w-2xl mx-auto">
        <section className="bg-base-200/70 p-6 rounded-lg shadow-md mb-8 backdrop-blur-sm border border-gray-100">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">
            風ぐるまってなに？
          </h2>
          <div className="space-y-4">
            <p>
              千代田区では、区民の皆さまの外出を支援するためのサービスを提供しています。地域福祉交通「風ぐるま」をはじめ、東京都シルバーパス、車いすの貸し出しなど、様々な支援があります。
            </p>
            <p>
              <strong>地域福祉交通「風ぐるま」</strong>
              は、区の施設および福祉施設を中心に千代田区内を運行している乗合バスです。どなたでも利用することができ、低床ノンステップのバリアフリー仕様で、車椅子用のスロープ板も常備されています。
            </p>
            <p className="mt-2">
              <a
                href="https://www.city.chiyoda.lg.jp/koho/kenko/koresha/gaishutsu/index.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                地域福祉交通「風ぐるま」・外出支援（千代田区公式サイト）
              </a>
            </p>
          </div>
        </section>

        <section className="bg-base-200/70 p-6 rounded-lg shadow-md mb-8 backdrop-blur-sm border border-gray-100">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">乗りかた</h2>
          <div className="space-y-4">
            <p>
              <strong>料金：</strong>
              基本料金は100円です。ほとんどの方はこの料金でご利用いただけます。
            </p>
            <p>
              <strong>支払方法：</strong>交通系ICカード（Suica、PASMO
              など）がご利用いただけます。もちろん現金でもお支払いいただけます。
            </p>
            <p>
              <strong>定期券：</strong>
              定期券もあります。区内在住者や障害者の方には割引制度もございます。
            </p>
            <p className="mt-2">
              詳しい料金体系については
              <a
                href="https://www.city.chiyoda.lg.jp/koho/kenko/koresha/gaishutsu/shin-kazaguruma/ryokin.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                千代田区公式ウェブサイト
              </a>
              をご覧ください。
            </p>
          </div>
        </section>

        <section className="bg-base-200/70 p-6 rounded-lg shadow-md mb-8 backdrop-blur-sm border border-gray-100">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">
            このサイトはなに？
          </h2>
          <div className="space-y-4">
            <p>
              このウェブサイトでは、風ぐるまの乗換案内サービスを提供しています。
            </p>
            <p>
              複雑な時刻表を読む必要はありません。出発地と目的地、時間を入力するだけで、最適な乗り換え方法を案内します。
            </p>
            <p>シンプルな操作で、千代田区内の移動がより便利になります。</p>
          </div>
        </section>

        <section className="bg-base-200/70 p-6 rounded-lg shadow-md mb-8 backdrop-blur-sm border border-gray-100">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">
            あなたは誰？
          </h2>
          <div className="space-y-4">
            <p>
              作者のNawashiroは、ただの一般市民です。このサイトは千代田区の公式サービスではなく、個人的な取り組みとして運営しています。
            </p>
            <p>
              きっかけは、母が入院したとき、病院まで風ぐるまで行こうとして時刻表をうまく読めず、区内中をさまよってしまった経験です。同じような困りごとを抱える方のために、このサービスを作りました。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
