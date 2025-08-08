### Prisma型システム最適化の知見

1. **型定義の基本形式**
   - `Prisma.ModelGetPayload<{...}>`: モデルとクエリの型定義に最適
   - 例: `type PrismaStop = Prisma.StopGetPayload<{ include: { stop_times: true } }>;`

2. **TypeScript 4.9以降のsatisfies演算子の活用**
   - 型を保持しながら型チェックができる
   - 例: `const query = { include: {...} } satisfies Prisma.Args<...>;`

3. **orderBy句の正しい型設定**
   - オブジェクトには明示的にstring literalを指定
   - 例: `orderBy: { departure_time: "asc" }`

4. **型変換の明示化**
   - 中間型を定義してからマッピングするパターンが安全
   - 例: `formattedDepartures.map(fd => ({ routeId: fd.route_id, ... }))`

5. **使用可能な型ユーティリティ**
   - `Prisma.Args<Type, Operation>`: 操作の引数型を取得
   - `Prisma.Result<Type, Args, Operation>`: 結果の型を取得
   - バージョン4.9.0以降で使用可能

6. **カスタムオブジェクト型の定義**
   - 返り値に複合型を使用する場合は具体的にプロパティを列挙
   - 例: `nearestStop: { id: string, name: string, ..., distance: number } | null`

7. **Prisma 7.0.0への備え**
   - `generator`セクションで`output`パスの明示的な指定が必須になる予定
   - 推奨パス: `output = "../node_modules/.prisma/client"`
