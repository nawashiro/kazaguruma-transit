"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";

export default function Usage() {
  return (
    <div className="container ruby-text">
      <header className="text-center my-4">
        <h1 className="text-3xl font-bold">
          <ruby>
            風<rt>かざ</rt>
          </ruby>
          ぐるま乗換案内の使いかた
        </h1>
        <p className="mt-2 text-xl">かんたんに千代田区内を移動するために</p>
      </header>
      <main className="max-w-md mx-auto space-y-4">
        <Card title="目次">
          <ul className="menu bg-base-100 p-0 ">
            <li>
              <a href="#basic-usage" className="inline">
                基本的な使いかた
              </a>
            </li>
            <li>
              <a href="#origin-selection" className="inline whitespace-nowrap">
                出発地・目的地の選び方
              </a>
            </li>
            <li>
              <a href="#destination-selection" className="inline">
                風ぐるまで行ける場所の探し方
              </a>
            </li>
            <li>
              <a href="#install-app" className="inline">
                インストールしていつでも使えるようにする
              </a>
            </li>
            <li>
              <a href="#rubyful-button" className="inline">
                ふりながをつける / 消す
              </a>
            </li>
          </ul>
        </Card>

        <Card id="basic-usage" className="shadow-md" title="基本的な使いかた">
          <div className="space-y-4">
            <p>
              風ぐるま乗換案内は、千代田区内の移動をサポートするためのサービスです。以下のステップで簡単に最適な経路を検索できます。
            </p>
            <ol className="list-decimal list-inside space-y-2 ">
              <li>出発地を選択</li>
              <li>目的地を選択</li>
              <li>出発時刻か到着時刻を選択</li>
              <li>検索ボタンをクリック</li>
            </ol>
            <p>
              印刷機能があります。印刷すれば、経路を誰かに手渡したり、思い出したりするのに便利です。
            </p>
            <p>
              私は障害特性により働くことができません。このサービスは生活費を切り崩して運営しています。サービスの存続のために支援をお願いしています。
            </p>
          </div>
        </Card>

        <Card
          id="origin-selection"
          className="shadow-md"
          title="出発地・目的地の選び方"
        >
          <div className="space-y-4">
            <p>出発地・目的地は以下のいずれかの方法で選択できます。</p>
            <ul className="list-disc list-inside space-y-2 ">
              <li>
                現在地ボタンを使用して、お使いの端末の位置情報から自動設定
              </li>
              <li>住所や施設名で検索</li>
            </ul>
            <p>
              選択した場所の周辺にある最寄りのバス停が自動的に検出されます。
            </p>
            <p>このために、位置情報を端末に要求することがあります。</p>
          </div>
        </Card>

        <Card
          id="destination-selection"
          className="shadow-md"
          title="風ぐるまで行ける場所の探し方"
        >
          <div className="space-y-4">
            <p>
              <Link href="/locations" className="link">
                場所を探す
              </Link>
              から区内のさまざまな場所を探すことができます。
            </p>
            <ul className="list-disc list-inside space-y-2 ">
              <li>カテゴリを選択して探す</li>
              <li>現在地を指定して周辺の場所を探す</li>
              <li>任意の場所を検索して周辺の場所を探す</li>
            </ul>
            <p>
              ただし、この場所データはボランティアが整備したものなので、間違っていることがあります。
            </p>
            <p>
              もうない場所、新しくできた場所がある場合、
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSeZ1eufe_2aZkRWQwr-RuCceUYUMJ7WmSfUr1ZsX5QTDRqFKQ/viewform?usp=header"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                こちらのフォーム
              </a>
              からお知らせください。
            </p>
          </div>
        </Card>

        <Card
          id="install-app"
          className="shadow-md"
          title="インストールしていつでも使えるようにする"
        >
          <div className="space-y-4">
            <p>
              このサービスは、ブラウザで動作するウェブアプリです。ブラウザによっては、インストールしていつでも使えるようにすることができます。
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>このページを開いたままブラウザのメニューをタップ</li>
              <li>「ホーム画面に追加」をタップ</li>
            </ol>
          </div>
        </Card>

        <Card
          id="rubyful-button"
          className="shadow-md"
          title="ふりながをつける / 消す"
        >
          <div className="space-y-4">
            <p>
              このサイトは、一般財団法人ルビ財団が提供するルビフルボタンを備えています。
            </p>
            <p>
              右下に出ているルビフルボタンを使うと、ふりながをつける /
              消すことができます。
            </p>
            <p>
              機械的につけているため、誤っている場合があります。また、このウェブサイトのコンテンツと競合してうまく動かないことがあります。そのため、一部の動的なコンテンツや地名に、ふりがなをつけていない場合があります。
            </p>
            <p>
              ルビフルボタンについては、
              <a
                href="https://rubizaidan.jp/rubyful-button/"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                ルビ財団ウェブサイト
              </a>
              をご覧ください。
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}
