"use client";

import Link from "next/link";
import KofiSupportCard from "../../components/KofiSupportCard";

export default function BeginnersGuide() {
  return (
    <div className="container">
      <header className="text-center my-4">
        <h1 className="text-3xl font-bold">風ぐるまは初めて？</h1>
        <p className="mt-2 text-lg">ビギナーズガイド</p>
      </header>

      <KofiSupportCard />

      <div className="max-w-md mx-auto space-y-4">
        <section className="card bg-base-200/70 shadow-md">
          <div className="card-body">
            <h2 className="card-title">風ぐるまってなに？</h2>
            <div className="space-y-4">
              <p>
                千代田区は、区民の外出を支援するためのサービスを提供しています。地域福祉交通「風ぐるま」をはじめ、東京都シルバーパス、車いすの貸し出しなど、様々な支援があります。
              </p>
              <p>
                <strong>地域福祉交通「風ぐるま」</strong>
                は、区の施設および福祉施設を中心に千代田区内を運行している乗合バスです。だれでも利用することができ、低床ノンステップのバリアフリー仕様で、車椅子用のスロープ板も常備されています。
              </p>
              <p>
                <a
                  href="https://www.city.chiyoda.lg.jp/koho/kenko/koresha/gaishutsu/index.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary"
                >
                  地域福祉交通「風ぐるま」・外出支援（千代田区公式サイト）
                </a>
              </p>
            </div>
          </div>
        </section>

        <section className="card bg-base-200/70 shadow-md">
          <div className="card-body">
            <h2 className="card-title">乗りかた</h2>
            <div className="space-y-4">
              <p>
                <strong>料金：</strong>
                基本料金は100円です。ほとんどの人はこの料金で利用できます。
              </p>
              <p>
                <strong>支払方法：</strong>交通系ICカード（Suica、PASMO
                など）が使えます。もちろん現金でも支払いできます。
              </p>
              <p>
                <strong>定期券：</strong>
                定期券もあります。区内在住者や障害者の方には割引制度もあります。
              </p>
              <p>
                詳しい料金体系については
                <a
                  href="https://www.city.chiyoda.lg.jp/koho/kenko/koresha/gaishutsu/shin-kazaguruma/ryokin.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary"
                >
                  千代田区公式ウェブサイト
                </a>
                をご覧ください。
              </p>
            </div>
          </div>
        </section>

        <section className="card bg-base-200/70 shadow-md">
          <div className="card-body">
            <h2 className="card-title">このサイトはなに？</h2>
            <div className="space-y-4">
              <p>
                このウェブサイトでは、風ぐるまの乗換案内サービスを提供しています。
              </p>
              <p>
                複雑な時刻表を読む必要はありません。出発地と目的地、時間を入力するだけで、最適な乗り換え方法を案内します。
              </p>
              <p>シンプルな操作で、千代田区内の移動がより便利になります。</p>
            </div>
          </div>
        </section>

        <section className="card bg-base-200/70 shadow-md">
          <div className="card-body">
            <h2 className="card-title">あなたは誰？</h2>
            <div className="space-y-4">
              <p>
                作者のNawashiroは、ただの一般市民です。このサイトは千代田区の公式サービスではなく、個人的な取り組みとして運営しています。
              </p>
              <p>
                きっかけは、母が入院したとき、病院まで風ぐるまで行こうとして時刻表をうまく読めず、区内中をさまよってしまった経験です。同じような困りごとを抱える人のために、このサービスを作りました。
              </p>
            </div>
          </div>
        </section>

        <section className="card bg-base-200/70 shadow-md">
          <div className="card-body">
            <h2 className="card-title">お金をとるの？</h2>
            <div className="space-y-4">
              <p>無料でも使えます。ただし、一時間に10回までです。</p>
              <p>継続的な支援者は、無制限に利用することができます。</p>
              <p>
                Nawashiroは、労働災害で障害を負い、ふつうの仕事をすることができません。貯金を取り崩して生活しています。
              </p>
              <p>
                このサービスには運用費がかかります。私の生活の負担にならないために、支援をお願いしています。
              </p>
              <p>
                継続的な支援があれば、活動を続けることができるかもしれません。
              </p>
              <p>
                支援してくれる人は、
                <a
                  href="https://ko-fi.com/nawashiro/tiers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary"
                >
                  Ko-fi
                </a>
                からお願いします。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
