# ローカルのChromeを動かす

開発機にChromeの依存ライブラリが入っていない場合、PDFと地図の検証ができません。この手順はシステムを変更せず、ユーザー領域へライブラリを展開します。

## 対象と前提

- Ubuntu 24.04 以降、または Debian 12 以降
- `apt-get download` と `dpkg-deb` が使えること
- `npm install` 済みで、puppeteer がChromeを取得していること

スクリプトの `PACKAGES` は Ubuntu 26.04 の t64 パッケージ名です。Debian 12 など `t64` のない配布版では、`libasound2`・`libatk1.0-0`・`libatk-bridge2.0-0`・`libatspi2.0-0`・`libcups2` へ直してください。

## 手順

スクリプトを実行します。

```bash
sh scripts/setup-local-chrome.sh
```

スクリプトは次の処理を行います。

1. `~/.local/share/kazaguruma/chrome-libs` へライブラリを展開します。
2. `~/.local/bin/chrome-kazaguruma` に起動用ラッパーを用意します。
3. 設定すべき環境変数を表示します。

表示された値を `.env.local` へ書きます。

```
PUPPETEER_EXECUTABLE_PATH=/home/ユーザー名/.local/bin/chrome-kazaguruma
```

## 確認

Chromeのバージョンを確認します。

```bash
PUPPETEER_EXECUTABLE_PATH="$HOME/.local/bin/chrome-kazaguruma" \
  node -e 'require("puppeteer").launch({headless:true,args:["--no-sandbox"]}).then(async b=>{console.log(await b.version());await b.close()})'
```

PDFを生成して地図を確認します。地図は平均彩度が0のモノクロで、道路と注記が読める濃淡を持ちます。

## うまく動かないとき

`ldd` で不足を確認します。

```bash
LIB_DIR="$HOME/.local/share/kazaguruma/chrome-libs/usr/lib/x86_64-linux-gnu"
LD_LIBRARY_PATH="$LIB_DIR" ldd "$(ls ~/.cache/puppeteer/chrome/*/chrome-linux64/chrome | tail -1)" | grep "not found"
```

不足が残る場合、配布版によってパッケージ名が異なります。`scripts/setup-local-chrome.sh` の `PACKAGES` を、その配布版の名前に直してください。

## この方法を選ばない場合

システムへライブラリを入れてよい場合は、ディストリビューションの手順でChromeの依存を導入します。`PUPPETEER_EXECUTABLE_PATH` は設定しません。

コンテナで検証する場合は [Docker構成](docker-setup.md) の手順を使います。本番イメージは依存ライブラリをイメージ内に持つため、この手順は不要です。
