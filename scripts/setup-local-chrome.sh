#!/bin/sh
# Chromeの起動に必要な共有ライブラリを、システムへ入れずにユーザー領域へ展開する。
# 対象は Ubuntu 24.04 以降と Debian 12 以降で、パッケージ名が t64 遷移後のもの。
# 展開先は $HOME/.local/share/kazaguruma/chrome-libs で、Chrome本体は puppeteer 管理の版をそのまま使う。
set -eu

PACKAGES="libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libavahi-client3 libavahi-common3 libcups2t64 libxdamage1 libxres1"

LIB_ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/kazaguruma/chrome-libs"
LIB_DIR="$LIB_ROOT/usr/lib/x86_64-linux-gnu"
BIN_DIR="$HOME/.local/bin"
WRAPPER="$BIN_DIR/chrome-kazaguruma"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

find_chrome() {
  for candidate in "$HOME"/.cache/puppeteer/chrome/*/chrome-linux64/chrome; do
    [ -x "$candidate" ] || continue
    printf '%s\n' "$candidate"
  done | sort -V | tail -n 1
}

report_missing() {
  chrome="$1"
  [ -n "${chrome:-}" ] || {
    echo "puppeteer管理のChromeが見つかりません。先に npm install を実行してください。" >&2
    return 1
  }
  LD_LIBRARY_PATH="$LIB_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" \
    ldd "$chrome" 2>/dev/null | awk '/not found/ { print $1 }' | sort -u
}

install_libraries() {
  mkdir -p "$LIB_DIR"
  cd "$WORK_DIR"
  for package in $PACKAGES; do
    apt-get download "$package" >/dev/null 2>&1 || {
      echo "パッケージを取得できません: $package" >&2
      echo "apt のパッケージ名は配布版ごとに異なります。" >&2
      exit 1
    }
  done
  for archive in ./*.deb; do
    dpkg-deb -x "$archive" "$LIB_ROOT"
  done
}

write_wrapper() {
  mkdir -p "$BIN_DIR"
  cat >"$WRAPPER" <<'WRAP'
#!/bin/sh
# Chromeの起動に足りない共有ライブラリを、ユーザー領域の展開先から補う。
set -eu
LIB_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/kazaguruma/chrome-libs/usr/lib/x86_64-linux-gnu"
CHROME=""
for candidate in "$HOME"/.cache/puppeteer/chrome/*/chrome-linux64/chrome; do
  [ -x "$candidate" ] || continue
  CHROME="$candidate"
done
[ -n "$CHROME" ] || {
  echo "puppeteer管理のChromeが見つかりません。" >&2
  exit 1
}
LD_LIBRARY_PATH="$LIB_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" exec "$CHROME" "$@"
WRAP
  chmod +x "$WRAPPER"
}

CHROME="$(find_chrome)"
if [ -z "$CHROME" ]; then
  echo "puppeteer管理のChromeが見つかりません。先に npm install を実行してください。" >&2
  exit 1
fi

if [ -d "$LIB_DIR" ] && [ -z "$(report_missing "$CHROME")" ]; then
  echo "共有ライブラリは導入済みです: $LIB_DIR"
else
  echo "共有ライブラリを取得しています。"
  install_libraries
  missing="$(report_missing "$CHROME")"
  if [ -n "$missing" ]; then
    echo "次のライブラリが未解決です。" >&2
    printf '%s\n' "$missing" >&2
    echo "配布版に合わせて PACKAGES を直してください。" >&2
    exit 1
  fi
  echo "共有ライブラリを展開しました: $LIB_DIR"
fi

write_wrapper
echo "起動用のラッパーを用意しました: $WRAPPER"

if command -v "$WRAPPER" >/dev/null 2>&1; then
  echo
  echo "PDFをローカルで生成するときは、次の環境変数を設定してください。"
  echo "PUPPETEER_EXECUTABLE_PATH=$WRAPPER"
else
  echo
  echo "$BIN_DIR が PATH にありません。次の環境変数を設定してください。"
  echo "PUPPETEER_EXECUTABLE_PATH=$WRAPPER"
fi
