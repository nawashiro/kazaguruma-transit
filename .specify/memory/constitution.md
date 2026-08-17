<!--
Sync Impact Report:
- Version Change: 1.9.0 -> 1.10.0
- Reason: 非典型記法の静的監査スコープを、現行production usageに基づき明文化。
- Modified Principles:
  * 検証スコープ方針を追加。
- Added Sections:
  * 検証スコープ方針
- Removed Sections:
  * なし
- Templates Status:
  ✅ .specify/templates/constitution-template.md: resolverで解決済み。既存constitutionの章構成を保持
  ✅ .specify/templates/plan-template.md: Constitution Check は本文の検証スコープ方針と整合
  ✅ .specify/templates/spec-template.md: 要求仕様に追加の必須セクションは不要
  ✅ .specify/templates/tasks-template.md: 静的監査のscope記録を含められる構成と整合
- Follow-up TODOs: None
-->

# Kazaguruma Transit 憲章

このファイルは GitHub Spec Kit 互換のために存在する。Coding agent 向けの実務上の正本は `AGENTS.md` である。

## 権限モデル

Agent は計画または実装を始める前に `AGENTS.md` を読み、その内容に従うこと。

このファイルと `AGENTS.md` が衝突する場合は、`AGENTS.md` を優先する。

## 作業言語

このリポジトリの作業言語は日本語である。
Spec Kit の `spec.md`、`plan.md`、`tasks.md`、チェックリスト、実装メモ、レビューコメント、作業報告は原則として日本語で書く。

## Core Principles

Core Principles は `AGENTS.md` の `## Core Principles` に置く。

1. Clear Naming
2. Simple Logic
3. Structured Organization
4. Type Safety
5. Test-First Development
6. Accessibility & UX
7. Documentation & Comments

Spec Kit の workflow は、`spec.md`、`plan.md`、`tasks.md` を作成するとき、この原則群を constitution gate として扱うこと。

## アクセシビリティ方針

このリポジトリのウェブアクセシビリティ方針は、原則としてウェブページ一式全体を対象とし、
WCAG 2.2 の適合レベル AA を目標とする。以下のチェックリストを各 feature の設計・実装・
レビュー時に直接確認する。チェック項目は WCAG 2.2 の A および AA レベルから抽出したもの
であり、該当する機能が存在しない項目は対象外として扱える。各チェック項目を確認するときは、
項目名に設定されたリンク先の WCAG 本文を必ず参照し、その達成基準、意図、適用範囲および
関連する達成方法を確認しなければならない。

### WCAG 2.2 AA チェックリスト

#### 1. 知覚可能

情報及びユーザインタフェース コンポーネントは、利用者が知覚できる方法で利用者に提示可能でなければならない。

- [ ] ガイドライン 1.1 テキストによる代替
  - [ ] [1.1.1 非テキストコンテンツ（レベル A）](../../docs/accessibility/Understanding/1-1/1-1-1.md)
- [ ] ガイドライン 1.2 時間依存メディア
  - [ ] [1.2.1 音声のみ及び映像のみ（収録済）（レベル A）](../../docs/accessibility/Understanding/1-2/1-2-1.md)
  - [ ] [1.2.2 キャプション（収録済）（レベル A）](../../docs/accessibility/Understanding/1-2/1-2-2.md)
  - [ ] [1.2.3 音声解説、又はメディアに対する代替（収録済）（レベル A）](../../docs/accessibility/Understanding/1-2/1-2-3.md)
  - [ ] [1.2.4 キャプション（ライブ）（レベル AA）](../../docs/accessibility/Understanding/1-2/1-2-4.md)
  - [ ] [1.2.5 音声解説（収録済）（レベル AA）](../../docs/accessibility/Understanding/1-2/1-2-5.md)
- [ ] ガイドライン 1.3 適応可能
  - [ ] [1.3.1 情報及び関係性（レベル A）](../../docs/accessibility/Understanding/1-3/1-3-1.md)
  - [ ] [1.3.2 意味のある順序（レベル A）](../../docs/accessibility/Understanding/1-3/1-3-2.md)
  - [ ] [1.3.3 感覚的な特徴（レベル A）](../../docs/accessibility/Understanding/1-3/1-3-3.md)
  - [ ] [1.3.4 各入力の目的（レベル AA）](../../docs/accessibility/Understanding/1-3/1-3-4.md)
- [ ] ガイドライン 1.4 判別可能
  - [ ] [1.4.1 色の使用（レベル A）](../../docs/accessibility/Understanding/1-4/1-4-1.md)
  - [ ] [1.4.2 音声の制御（レベル A）](../../docs/accessibility/Understanding/1-4/1-4-2.md)
  - [ ] [1.4.3 コントラスト（最低）（レベル AA）](../../docs/accessibility/Understanding/1-4/1-4-3.md)
  - [ ] [1.4.4 テキストのサイズ変更（レベル AA）](../../docs/accessibility/Understanding/1-4/1-4-4.md)
  - [ ] [1.4.5 画像化された文字（レベル AA）](../../docs/accessibility/Understanding/1-4/1-4-5.md)
  - [ ] [1.4.10 リフロー（レベル AA）](../../docs/accessibility/Understanding/1-4/1-4-10.md)
  - [ ] [1.4.11 非テキストのコントラスト（レベル AA）](../../docs/accessibility/Understanding/1-4/1-4-11.md)
  - [ ] [1.4.12 テキストの間隔（レベル AA）](../../docs/accessibility/Understanding/1-4/1-4-12.md)
  - [ ] [1.4.13 ホバー又はフォーカス時の内容表示（レベル AA）](../../docs/accessibility/Understanding/1-4/1-4-13.md)

#### 2. 操作可能

ユーザインタフェース コンポーネント及びナビゲーションは操作可能でなければならない。

- [ ] ガイドライン 2.1 キーボード操作可能
  - [ ] [2.1.1 キーボード（レベル A）](../../docs/accessibility/Understanding/2-1/2-1-1.md)
  - [ ] [2.1.2 キーボードトラップなし（レベル A）](../../docs/accessibility/Understanding/2-1/2-1-2.md)
  - [ ] [2.1.4 文字キーショートカット（レベル A）](../../docs/accessibility/Understanding/2-1/2-1-4.md)
- [ ] ガイドライン 2.2 十分な時間
  - [ ] [2.2.1 タイミング調整可能（レベル A）](../../docs/accessibility/Understanding/2-2/2-2-1.md)
  - [ ] [2.2.2 一時停止、停止、非表示（レベル A）](../../docs/accessibility/Understanding/2-2/2-2-2.md)
- [ ] ガイドライン 2.3 発作と身体的反応
  - [ ] [2.3.1 3 回の閃光、または閾値以下（レベル A）](../../docs/accessibility/Understanding/2-3/2-3-1.md)
- [ ] ガイドライン 2.4 ナビゲーション可能
  - [ ] [2.4.1 ブロックスキップ（レベル A）](../../docs/accessibility/Understanding/2-4/2-4-1.md)
  - [ ] [2.4.2 ページタイトル（レベル A）](../../docs/accessibility/Understanding/2-4/2-4-2.md)
  - [ ] [2.4.3 フォーカス順序（レベル A）](../../docs/accessibility/Understanding/2-4/2-4-3.md)
  - [ ] [2.4.4 リンクの目的（コンテキスト内）（レベル A）](../../docs/accessibility/Understanding/2-4/2-4-4.md)
  - [ ] [2.4.5 複数の手段（レベル AA）](../../docs/accessibility/Understanding/2-4/2-4-5.md)
  - [ ] [2.4.6 見出し及びラベル（レベル AA）](../../docs/accessibility/Understanding/2-4/2-4-6.md)
  - [ ] [2.4.7 フォーカス可視（レベル AA）](../../docs/accessibility/Understanding/2-4/2-4-7.md)
- [ ] ガイドライン 2.5 入力モダリティ
  - [ ] [2.5.1 ポインタによるジェスチャ（レベル A）](../../docs/accessibility/Understanding/2-5/2-5-1.md)
  - [ ] [2.5.2 ポインタのキャンセル（レベル A）](../../docs/accessibility/Understanding/2-5/2-5-2.md)
  - [ ] [2.5.3 ラベル名（レベル A）](../../docs/accessibility/Understanding/2-5/2-5-3.md)
  - [ ] [2.5.4 モーション起動（レベル A）](../../docs/accessibility/Understanding/2-5/2-5-4.md)
  - [ ] [2.5.7 ドラッグ操作（レベル AA）](../../docs/accessibility/Understanding/2-5/2-5-7.md)
  - [ ] [2.5.8 ターゲットサイズ（最小）（レベル AA）](../../docs/accessibility/Understanding/2-5/2-5-8.md)

#### 3. 理解可能

情報及びユーザインタフェースの操作は理解可能でなければならない。

- [ ] ガイドライン 3.1 読み取り可能
  - [ ] [3.1.1 ページの言語（レベル A）](../../docs/accessibility/Understanding/3-1/3-1-1.md)
  - [ ] [3.1.2 一部の言語（レベル AA）](../../docs/accessibility/Understanding/3-1/3-1-2.md)
- [ ] ガイドライン 3.2 予測可能
  - [ ] [3.2.1 フォーカス時の動作（レベル A）](../../docs/accessibility/Understanding/3-2/3-2-1.md)
  - [ ] [3.2.2 入力時の動作（レベル A）](../../docs/accessibility/Understanding/3-2/3-2-2.md)
  - [ ] [3.2.3 一貫したナビゲーション（レベル AA）](../../docs/accessibility/Understanding/3-2/3-2-3.md)
  - [ ] [3.2.4 一貫した識別（レベル AA）](../../docs/accessibility/Understanding/3-2/3-2-4.md)
- [ ] ガイドライン 3.3 入力支援
  - [ ] [3.3.1 エラーの特定（レベル A）](../../docs/accessibility/Understanding/3-3/3-3-1.md)
  - [ ] [3.3.2 ラベル又は説明（レベル A）](../../docs/accessibility/Understanding/3-3/3-3-2.md)
  - [ ] [3.3.3 エラー修正の提案（レベル AA）](../../docs/accessibility/Understanding/3-3/3-3-3.md)
  - [ ] [3.3.4 法的・財務・データのエラー防止（レベル AA）](../../docs/accessibility/Understanding/3-3/3-3-4.md)

#### 4. 堅牢性

コンテンツは、現在及び将来にわたって様々なユーザエージェント（支援技術を含む）によって解釈可能でなければならない。

- [ ] ガイドライン 4.1 互換性
  - [ ] [4.1.2 名前・役割・値（レベル A）](../../docs/accessibility/Understanding/4-1/4-1-2.md)
  - [ ] [4.1.3 ステータスメッセージ（レベル AA）](../../docs/accessibility/Understanding/4-1/4-1-3.md)

- UI、ナビゲーション、フォーム、エラー表示、ステータスメッセージ、動的コンテンツを変更する Spec Kit feature では、`plan.md` と `tasks.md` にアクセシビリティ確認を含める。
- ルビの補助テキストを除き、ユーザー向けテキストの算出フォントサイズは 14px 未満にしてはならない。
- UIのアイコンは手書きのインラインSVGを避け、`@heroicons/react` や `react-icons` などのReactアイコンコンポーネントを使用しなければならない。
- アクセシビリティ方針と実装都合が衝突する場合は、方針を優先し、満たせない理由と代替策を `plan.md` または `tasks.md` に明記する。

## 検証スコープ方針

静的契約テストは、現行production codeの使用実態に基づく有限の文法を対象とする。
非典型またはarbitraryな記述方式がコードベースのproduction codeに一件も存在しない場合、
その記法は当該テストのスコープ外とし、仮想的な使用例だけを理由に違反へ追加してはならない。

ただし、次の条件を満たさなければならない。

- production code（テスト、fixture、コメント、履歴資料を除く）を事前に一括検索し、使用件数0を記録する。
- 除外した記法と検索範囲を`spec.md`、`plan.md`、`tasks.md`またはレビュー記録へ明記する。
- 解析不能な記法を、現行production codeに実際の使用箇所がある状態で黙って通過させてはならない。その場合はfail-closedの違反、または明示的な契約追加として扱う。
- 後続変更で使用箇所が追加された場合、既存テストのスコープ外判断を再利用せず、使用箇所を含む新しいRED→review→実装の作業単位で再評価する。

この方針は、実在しない使用例に対する過剰な検査拡張を防ぎつつ、実際のproduction usageに対する検出漏れを許可しないためのものである。

## 技術スタックと制約

- **フレームワーク**: Next.js 15 (App Router), React 19
- **言語**: TypeScript 5 strict mode
- **UI**: Tailwind CSS 4 + DaisyUI 5
- **データベース**: SQLite + Prisma ORM
- **テスト**: Jest + React Testing Library
- **分散プロトコル**: Nostr (NIP-72, NIP-25)
- **パフォーマンス**: 既存アーキテクチャで測定可能な範囲では、API 応答 p95 を 200ms 以内に保つ。
- **GTFS データ**: GTFS import は build/start chain の中で実行される。
- **外部画像**: 外部 URL 画像は、Next.js `<Image>` が適さない場合に `<img>` を使ってよい。
- **ボタンスタイル**: DaisyUI cupcake の角丸が効かない場合は `rounded-full dark:rounded-sm` を使う。
- **日本語テキスト**: ルビ表示は既存の ruby text utilities/classes を使う。
- **セキュリティ**: API rate limiting を維持する。

## Nostr実装方針

Nostr readは`specs/017-discussion-read-executor`を正本とする。詳細は同仕様のデータモデルと契約を参照する。

- 画面とドメイン層はfilter組立て、業務判定、二段階read、UI表示だけを持つ。
- `q`参照の検証、正規化、重複除去は`DiscussionReferenceResolver`だけが担う。
- `DiscussionReadPlan`は正規化済みread要求を表す。複数filterは一回の購読で送る。
- `DiscussionReadExecutor`はrelay順位、relay set通信、completion、retry、relay実績を担う。
- readは有限initial readとする。non-EOSEは空やNot Foundと同一視せず、partial状態として表示する。
- Nostrリレーをイベントデータの正本とする。`sessionStorage`は暫定既知データとrelay実績だけを保持する。

## ユーザー名とパスキー名

- ユーザー名は、公開鍵から導出した BIP39 日本語ニーモニックコードの冒頭3単語とする。
- パスキー名は、ログインモーダルでユーザーが入力し、パスキー作成時に使用する端末上の名前とする。
- ユーザー名とパスキー名を同じ値として扱わず、ユーザー名をアカウント作成時の kind:0 Nostr プロフィールイベントへ保存しない。

## 開発ワークフロー

- 通常開発ブランチ: `dev`
- リリースブランチ: `master`
- 機能開発は `dev` から始める。
- 変更を完了扱いにする前に、`AGENTS.md` に記載された検証コマンドを実行する。
- Spec Kit を使う場合は、`spec.md`、`plan.md`、`tasks.md`、実装、検証の順で進める。

**Version**: 1.10.0 | **Ratified**: 2026-01-13 | **Last Amended**: 2026-08-16
