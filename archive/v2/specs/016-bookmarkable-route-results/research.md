# Research: ブックマーク可能な経路検索結果

## Decision 1: Google Maps型の座標ペアを使う

**Decision**: `origin=lat,lng` と `destination=lat,lng` を採用し、日時と真偽値条件を別パラメータにする。

**Rationale**: 人がURLを確認でき、JSONや二重encodeが不要で、場所名変更にも影響されない。

**Alternatives considered**: JSON一括値は既存destination deep linkと似るが可読性と検証が悪い。緯度・経度を4キーに分ける案はキーが増える。

## Decision 2: 結果ページとAPIを両方GETにする

**Decision**: ブラウザはGET `/routes?...`、結果ページはGET `/api/transit?...`を呼ぶ。既存POSTは残す。

**Rationale**: ユーザー要求を外部から観測可能な契約として満たし、既存呼び出しを壊さない。

**Alternatives considered**: 結果ページだけGETで内部POSTを維持する案はブックマーク性を満たすが、「検索もGET」という要求を弱く解釈することになる。

## Decision 3: 結果表示はクライアント境界へ移す

**Decision**: `/routes/page.tsx`は薄く保ち、client componentがURL条件から検索状態を管理する。

**Rationale**: rate-limit modal、PDF、カレンダー、Nostrメモなど既存client UIを最小変更で再利用できる。

**Alternatives considered**: server componentの検索は初期HTMLに有利だが、既存rate-limitと再試行状態を二重実装する。
