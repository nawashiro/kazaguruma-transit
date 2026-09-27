# 調査:Discussion read executor

## 決定1:read executorを`src/lib/discussion`へ置く

- **Decision**:`DiscussionReadExecutor`を`src/lib/discussion`に置く。
- **Rationale**:relay URLの選択は各Providerのread対象と状態に依存するためProvider側で決定する。`DiscussionReadExecutor`は順序済みURLのattempt分割、completion、retry、実績統合に限定し、`NostrService`はNDK (Nostr Development Kit)接続と購読の汎用境界として維持する。
- **Alternatives considered**:
  - 各画面が`DiscussionNdkGateway`を直接呼ぶ。attempt分割、completion、retry規則が再び分岐するため採用しない。
  - executorへ候補源の意味付けを追加する。Providerごとのread方針が共通層へ漏れるため採用しない。

## 決定2:参照検証を通信から分離する

- **Decision**:`DiscussionReferenceResolver`を通信なしの入力境界にする。
- **Rationale**:`q` tag、naddr、既知Discussion IDは入力形式が異なる。executorは正規化済みfilterとProvider選択済みrelay URLだけを受け取る。
- **Alternatives considered**:
  - executorで文字列を解析する。通信と入力検証が結合し、画面固有の参照規則を再利用できないため採用しない。

## 決定3:filter群を一回の購読にまとめる

- **Decision**:`NostrService.collectEventsWithCompletion()`はfilterごとの`ndk.subscribe()`ループを廃止する。一回の`ndk.subscribe(filters, { ...options, relaySet })`でfilter配列を渡す。
- **Rationale**:NDKはfilter配列を一つのsubscriptionに渡せる。subscriptionは選別済みrelayごとに複数filterを含むREQを送る。現行実装はfilter数と同数の購読を作り、参照先会話のN+1通信を起こす。
- **Alternatives considered**:
  - `fetchEvents()`を使う。completion状態、idle timeout、暫定表示、source relay記録を保持できないため採用しない。
  - filterを一つへOR結合する。authorと`#d`の対応が崩れ、意図しないkind 34550を取得するため採用しない。

## 決定4:一度だけの自動再読をexecutorが制御する

- **Decision**:Providerが渡したURL列の初回attemptがEOSE以外で終わり、未試行relayが残る場合だけ、次の最大3relayへ一度だけ自動再読する。
- **Rationale**:Providerが選択したrelay列の沈黙で会話不存在を確定しない。一方で無制限のrelay拡大は待機時間とrelay負荷を増やす。
- **Alternatives considered**:
  - 手動再読み込みだけにする。`/settings`と`/discussions`の可視性差を残すため採用しない。
  - EOSEでも再読する。空結果を不必要に拡大問い合わせするため採用しない。
  - 全候補を巡回する。最悪待機時間が候補数に比例するため採用しない。

## 決定5:retry中は暫定eventsを表示する

- **Decision**:executorはattempt完了を通知するcallbackを持つ。画面は初回eventsを暫定表示し、retry結果をevent IDで結合する。
- **Rationale**:retry完了を待つと、既に取得できた会話や投稿を隠す。timeoutだけの空結果は既存eventsを消してはならない。
- **Alternatives considered**:
  - 最終結果だけをPromiseで返す。最大hard timeoutまで表示が遅れるため採用しない。

## 決定6:最終EOSEを完了として扱う

- **Decision**:初回が非EOSEでも、自動再読がEOSEなら合成結果の`completionReason`を`eose`にする。
- **Rationale**:利用者の決定である。UIは部分取得警告を消す。attempt履歴は観測情報として残す。
- **Alternatives considered**:
  - 一回でもtimeoutならpartialを維持する。保守的だが、利用者が選んだ完了規則と一致しないため採用しない。

## 決定7:page分割は導入しない

- **Decision**:filter数上限、page cursor、続き取得を実装しない。
- **Rationale**:現在の必要性は実証されていない。filter結合は必要な最適化だが、page状態は追加のUXと整合性規則を増やす。
- **Alternatives considered**:
  - 先行して固定上限を設ける。根拠のない欠落または複雑な続き取得を導入するため採用しない。

## 決定8:リアルタイム購読を廃止する

- **Decision**:承認、編集、モデレーター画面はリアルタイム購読を使わない。共通executorによる完了型initial readへ置換する。
- **Rationale**:ユーザーがリアルタイム購読は誤りであると決定した。これにより、attempt分割、timeout、retry、状態表示を一つのexecutorへ統一する。relay URLの選択は各Providerに残す。
- **Alternatives considered**:
  - executorへstreaming APIを追加する。不要な継続接続と複雑な停止規則を導入するため採用しない。
  - 既存subscriptionを残す。全Discussion画面の通信DRY化に反するため採用しない。
