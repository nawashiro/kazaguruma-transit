"use client";

import Link from "next/link";

export default function Usage() {
  return (
    <div className="container">
      <header className="text-center my-4">
        <h1 className="text-3xl font-bold">風ぐるま乗換案内の使いかた</h1>
        <p className="mt-2 text-xl">かんたんに千代田区内を移動するために</p>
      </header>
      <main>
        <div className="max-w-md mx-auto mb-6 card bg-base-100 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-xl">目次</h2>
            <ul className="menu bg-base-100 p-0 text-base">
              <li>
                <a href="#basic-usage">基本的な使いかた</a>
              </li>
              <li>
                <a href="#origin-selection">出発地・目的地の選び方</a>
              </li>
              <li>
                <a href="#destination-selection">
                  風ぐるまで行ける場所の探し方
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <section id="basic-usage" className="card bg-base-200/70 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-xl">基本的な使いかた</h2>
              <div className="space-y-4">
                <p className="text-base">
                  風ぐるま乗換案内は、千代田区内の移動をサポートするためのサービスです。以下のステップで簡単に最適な経路を検索できます。
                </p>
                <ol className="list-decimal list-inside space-y-2 text-base">
                  <li>出発地を選択</li>
                  <li>目的地を選択</li>
                  <li>出発時刻か到着時刻を選択</li>
                  <li>検索ボタンをクリック</li>
                </ol>
                <p className="text-base">
                  印刷機能があります。印刷すれば、経路を誰かに手渡したり、思い出したりするのに便利です。
                </p>
                <p className="text-base">
                  私は障害特性により働くことができません。このサービスは生活費を切り崩して運営しています。サービスの存続のために支援をお願いしています。
                </p>
              </div>
            </div>
          </section>

          <section
            id="origin-selection"
            className="card bg-base-200/70 shadow-md"
          >
            <div className="card-body">
              <h2 className="card-title text-xl">出発地・目的地の選び方</h2>
              <div className="space-y-4">
                <p className="text-base">
                  出発地・目的地は以下のいずれかの方法で選択できます。
                </p>
                <ul className="list-disc list-inside space-y-2 text-base">
                  <li>
                    現在地ボタンを使用して、お使いの端末の位置情報から自動設定
                  </li>
                  <li>住所や施設名で検索</li>
                </ul>
                <p className="text-base">
                  選択した場所の周辺にある最寄りのバス停が自動的に検出されます。
                </p>
                <p className="text-base">
                  このために、位置情報を端末に要求することがあります。
                </p>
              </div>
            </div>
          </section>

          <section
            id="destination-selection"
            className="card bg-base-200/70 shadow-md"
          >
            <div className="card-body">
              <h2 className="card-title text-xl">
                風ぐるまで行ける場所の探し方
              </h2>
              <div className="space-y-4">
                <p className="text-base">
                  <Link href="/locations" className="link link-primary">
                    場所を探す
                  </Link>
                  から区内のさまざまな場所を探すことができます。
                </p>
                <ul className="list-disc list-inside space-y-2 text-base">
                  <li>カテゴリを選択して探す</li>
                  <li>現在地を指定して周辺の場所を探す</li>
                  <li>任意の場所を検索して周辺の場所を探す</li>
                </ul>
                <p className="text-base">
                  ただし、この場所データはボランティアが整備したものなので、間違っていることがあります。
                </p>
                <p className="text-base">
                  もうない場所、新しくできた場所がある場合、
                  <a
                    href="https://docs.google.com/forms/d/e/1FAIpQLSeZ1eufe_2aZkRWQwr-RuCceUYUMJ7WmSfUr1ZsX5QTDRqFKQ/viewform?usp=header"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link link-primary"
                  >
                    こちらのフォーム
                  </a>
                  からお知らせください。
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
