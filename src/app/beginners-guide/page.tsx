"use client";

export default function BeginnersGuide() {
  return (
    <div className="container">
      <header className="text-center my-4">
        <h1 className="text-3xl font-bold">風ぐるまは初めて？</h1>
        <p className="mt-2 text-xl">ビギナーズガイド</p>
      </header>
      <main>
        <div className="max-w-md mx-auto mb-6 card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-xl">目次</h2>
            <ul className="menu bg-base-100 p-0 text-base">
              <li>
                <a href="#what-is">風ぐるまってなに？</a>
              </li>
              <li>
                <a href="#how-to-ride">乗りかた</a>
              </li>
              <li>
                <a href="#how-to-ride-with-wheelchair">
                  車いすやベビーカーのかたへ
                </a>
              </li>
              <li>
                <a href="#about-site">このサイトはなに？</a>
              </li>
              <li>
                <a href="#about-me">あなたは誰？</a>
              </li>
              <li>
                <a href="#payment">お金をとるの？</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <section id="what-is" className="card bg-base-200/70 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-xl">風ぐるまってなに？</h2>
              <div className="space-y-4">
                <p className="text-base">
                  千代田区は、区民の外出を支援するためのサービスを提供しています。地域福祉交通「風ぐるま」をはじめ、東京都シルバーパス、車いすの貸し出しなど、様々な支援があります。
                </p>
                <p className="text-base">
                  <strong>地域福祉交通「風ぐるま」</strong>
                  は、区の施設および福祉施設を中心に千代田区内を運行している乗合バスです。だれでも利用することができ、低床ノンステップのバリアフリー仕様で、車椅子用のスロープ板も常備されています。
                </p>
                <p className="text-base">
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

          <section id="how-to-ride" className="card bg-base-200/70 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-xl">乗りかた</h2>
              <div className="space-y-4">
                <p className="text-base">
                  <strong>料金：</strong>
                  前払いで100円です。ほとんどの人はこの料金で利用できます。
                </p>
                <p className="text-base">
                  <strong>支払方法：</strong>交通系ICカード（Suica、PASMO
                  など）が使えます。現金でも支払いできます。両替はできません。
                </p>
                <p className="text-base">
                  <strong>定期券：</strong>
                  定期券もあります。区内在住者や障害者の方には割引制度もあります。
                </p>
                <p className="text-base">
                  詳しい料金体系については
                  <a
                    href="https://www.city.chiyoda.lg.jp/koho/kenko/koresha/gaishutsu/shin-kazaguruma/ryokin.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-primary"
                  >
                    「風ぐるま」料金・乗車券（千代田区公式サイト）
                  </a>
                  をご覧ください。
                </p>
              </div>
            </div>
          </section>

          <section
            id="how-to-ride-with-wheelchair"
            className="card bg-base-200/70 shadow-md"
          >
            <div className="card-body">
              <h2 className="card-title text-xl">車いすやベビーカーのかたへ</h2>
              <div className="space-y-4">
                <p className="text-base">
                  <strong>スロープ板：</strong>
                  スロープ板が常備されています。歩道から直接乗車が可能です。見つけると運転手のかたが対応してくれます。声かけがしにくい利用者のかたでも大丈夫です。
                </p>
                <p className="text-base">
                  <strong>ベビーカー：</strong>
                  ベビーカーは原則としてたたまずに利用することができます。
                </p>
                <p className="text-base">
                  その他、詳しい情報については
                  <a
                    href="https://www.city.chiyoda.lg.jp/koho/kenko/koresha/gaishutsu/shin-kazaguruma/qa.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-primary"
                  >
                    千代田区公式FAQ
                  </a>
                  をご覧ください。
                </p>
              </div>
            </div>
          </section>

          <section id="about-site" className="card bg-base-200/70 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-xl">このサイトはなに？</h2>
              <div className="space-y-4">
                <p className="text-base">
                  このウェブサイトでは、風ぐるまの乗換案内サービスを提供しています。
                </p>
                <p className="text-base">
                  複雑な時刻表を読む必要はありません。出発地と目的地、時間を入力するだけで、最適な乗り換え方法を案内します。
                </p>
                <p className="text-base">
                  シンプルな操作で、千代田区内の移動がより便利になります。
                </p>
              </div>
            </div>
          </section>

          <section id="about-me" className="card bg-base-200/70 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-xl">あなたは誰？</h2>
              <div className="space-y-4">
                <p className="text-base">
                  作者のNawashiroは、ただの一般市民です。このサイトは千代田区の公式サービスではなく、個人的な取り組みとして運営しています。
                </p>
                <p className="text-base">
                  きっかけは、母が入院したとき、病院まで風ぐるまで行こうとして時刻表をうまく読めず、区内中をさまよってしまった経験です。同じような困りごとを抱える人のために、このサービスを作りました。
                </p>
              </div>
            </div>
          </section>

          <section id="payment" className="card bg-base-200/70 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-xl">お金をとるの？</h2>
              <div className="space-y-4">
                <p className="text-base">
                  原則として無料で使うことができます。
                </p>
                <p className="text-base">
                  Nawashiroは、労働災害で障害を負い、ふつうの仕事をすることができません。貯金を取り崩して生活しています。
                </p>
                <p className="text-base">
                  継続的な支援があれば、活動を続けることができるかもしれません。
                </p>
                <p className="text-base">
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
      </main>
    </div>
  );
}
