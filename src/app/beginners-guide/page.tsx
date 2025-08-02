"use client";

import Card from "@/components/ui/Card";

export default function BeginnersGuide() {
  return (
    <div className="container ruby-text">
      <header className="text-center my-4">
        <h1 className="text-3xl font-bold">
          <ruby>
            風<rt>かざ</rt>
          </ruby>
          ぐるまは初めて？
        </h1>
        <p className="mt-2 text-xl">ビギナーズガイド</p>
      </header>
      <main className="max-w-md mx-auto space-y-4">
        <Card title="目次">
          <ul className="menu bg-base-100 p-0">
            <li>
              <a href="#what-is" className="inline">
                風ぐるまってなに？
              </a>
            </li>
            <li>
              <a href="#how-to-ride" className="inline">
                乗りかた
              </a>
            </li>
            <li>
              <a
                href="#how-to-ride-with-wheelchair"
                className="inline whitespace-nowrap"
              >
                車いすやベビーカーのかたへ
              </a>
            </li>
            <li>
              <a href="#about-site" className="inline">
                このサイトはなに？
              </a>
            </li>
            <li>
              <a href="#about-me" className="inline">
                あなたは誰？
              </a>
            </li>
            <li>
              <a href="#payment" className="inline">
                お金をとるの？
              </a>
            </li>
          </ul>
        </Card>

        <Card id="what-is" title="風ぐるまってなに？">
          <div className="space-y-4">
            <p>
              千代田区は、区民の外出を支援するためのサービスを提供しています。地域福祉交通「
              <ruby>
                風<rt>かざ</rt>
              </ruby>
              ぐるま」をはじめ、東京都シルバーパス、車いすの貸し出しなど、様々な支援があります。
            </p>
            <p>
              <strong>
                地域福祉交通「
                <ruby>
                  風<rt>かざ</rt>
                </ruby>
                ぐるま」
              </strong>
              は、区の施設および福祉施設を中心に千代田区内を運行している乗合バスです。だれでも利用することができ、低床ノンステップのバリアフリー仕様で、車椅子用のスロープ板も常備されています。
            </p>
            <p>
              <a
                href="https://www.city.chiyoda.lg.jp/koho/kenko/koresha/gaishutsu/index.html"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                地域福祉交通「
                <ruby>
                  風<rt>かざ</rt>
                </ruby>
                ぐるま」・外出支援（千代田区公式サイト）
              </a>
            </p>
          </div>
        </Card>

        <Card id="how-to-ride" title="乗りかた">
          <div className="space-y-4">
            <p>
              <strong>料金：</strong>
              前払いで100円です。ほとんどの人はこの料金で利用できます。
            </p>
            <p>
              <strong>支払方法：</strong>交通系ICカード（Suica、PASMO
              など）が使えます。現金でも支払いできます。両替はできません。
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
                className="link"
              >
                「
                <ruby>
                  風<rt>かざ</rt>
                </ruby>
                ぐるま」料金・乗車券（千代田区公式サイト）
              </a>
              をご覧ください。
            </p>
          </div>
        </Card>

        <Card
          id="how-to-ride-with-wheelchair"
          title="車いすやベビーカーのかたへ"
        >
          <div className="space-y-4">
            <p>
              <strong>スロープ板：</strong>
              スロープ板が常備されています。歩道から直接乗車が可能です。見つけると運転手のかたが対応してくれます。声かけがしにくい利用者のかたでも大丈夫です。
            </p>
            <p>
              <strong>ベビーカー：</strong>
              ベビーカーは原則としてたたまずに利用することができます。
            </p>
            <p>
              その他、詳しい情報については
              <a
                href="https://www.city.chiyoda.lg.jp/koho/kenko/koresha/gaishutsu/shin-kazaguruma/qa.html"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                千代田区公式FAQ
              </a>
              をご覧ください。
            </p>
          </div>
        </Card>

        <Card id="about-site" title="このサイトはなに？">
          <div className="space-y-4">
            <p>
              このウェブサイトでは、
              <ruby>
                風<rt>かざ</rt>
              </ruby>
              ぐるまの乗換案内サービスを提供しています。
            </p>
            <p>
              複雑な時刻表を読む必要はありません。出発地と目的地、時間を入力するだけで、最適な乗り換え方法を案内します。
            </p>
            <p>シンプルな操作で、千代田区内の移動がより便利になります。</p>
          </div>
        </Card>

        <Card id="about-me" title="あなたは誰？">
          <div className="space-y-4">
            <p>
              作者のNawashiroは、ただの一般市民です。このサイトは千代田区の公式サービスではなく、個人的な取り組みとして運営しています。
            </p>
            <p>
              きっかけは、母が入院したとき、病院まで風ぐるまで行こうとして時刻表をうまく読めず、区内中をさまよってしまった経験です。同じような困りごとを抱える人のために、このサービスを作りました。
            </p>
          </div>
        </Card>

        <Card id="payment" title="お金をとるの？">
          <div className="space-y-4">
            <p>原則として無料で使うことができます。</p>
            <p>
              Nawashiroは、労働災害で障害を負い、ふつうの仕事をすることができません。貯金を取り崩して生活しています。
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
                className="link"
              >
                Ko-fi
              </a>
              からお願いします。
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
