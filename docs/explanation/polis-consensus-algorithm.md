# Polisに着想を得た合意分析

## 範囲

この文書は現行実装を説明します。現行仕様の正本ではありません。数値、型、境界条件は[`evaluation-service.ts`](../../src/lib/evaluation/evaluation-service.ts)と[`polis-consensus.ts`](../../src/lib/evaluation/polis-consensus.ts)を参照してください。

理論的背景は[ホワイトペーパー](/docs/explanation/polis-consensus-whitepaper.md)を参照してください。

## 位置づけ

Polisは、多数の自由記述と投票から参加者の意見空間を整理するオープンソースプロジェクトです。公式資料は次です。

- [Polis公式リポジトリ](https://github.com/compdemocracy/polis)
- [Polis: Scaling Deliberation by Mapping High Dimensional Opinion Spaces](https://www.e-revistes.uji.es/index.php/recerca/article/view/5516/6558)

本アプリはPolisの考え方を参考にします。公式Polisのサーバーや`math`モジュールを実行しません。現行コードはTypeScriptで`ml-matrix`、`ml-pca`、`ml-kmeans`を使います。

## 現行パイプライン

```text
評価イベント
  ↓
承認済み投稿だけを選択
  ↓
参加者 × 投稿の投票行列
  ↓
PCAまたはSVD
  ↓
K-meansとCalinski-Harabasz Index
  ↓
クラスタ横断合意と代表性
  ↓
Benjamini-Hochberg補正
  ↓
画面表示
```

`EvaluationService`は評価と投稿を投票データへ変換します。`PolisConsensus`はその投票データを分析します。会話詳細画面は、承認が確定した投稿だけを分析へ渡します。

## 出力とUI

`PolisConsensus`は次を返します。

- `groupAwareConsensus`: 投稿IDと合意スコアの対応
- `groupRepresentativeComments`: クラスタIDと代表的な投稿の対応

`EvaluationService`は投稿オブジェクトを結果へ結合します。合意結果をスコア降順で最大10件に制限します。各クラスタの代表的な投稿を最大5件に制限します。

会話詳細画面は合意結果の先頭5件を表示します。代表的な投稿はクラスタ別タブで表示します。画面には「共通の意見」と「グループA」以降のタブがあります。合意スコアの数値は画面に表示しません。

## 最低条件とエラー

分析は次の条件で空結果になります。

- 評価が5件未満
- 承認済み投稿が2件未満
- 変換後投票が5件未満
- 参加者が2人未満
- 投稿が2件未満

行列やクラスタデータが不正な場合はログを出し、空結果または単一クラスタへフォールバックします。分析失敗時、`EvaluationService`は空の合意結果と代表結果を返します。
