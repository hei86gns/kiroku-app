# kiroku-app（記録アプリ）

作業を始める前に、必ず `HANDOFF.md` を読んでください。進み具合・決定事項・デザインの方針・次にやることがまとまっています。

- 仕様：`記録アプリ仕様.md`
- 実装計画：`docs/plan-v1.md`
- デザインの見本：`docs/mockup.html`（本実装の見た目の基準）

大きな変更（データ構造、保存方式、認証まわりなど）をしたら、`HANDOFF.md` も更新してください。

## よく使うコマンド
- `npm run dev`：手元で起動（http://localhost:5173/kiroku-app/）
- `npm run build`：型チェック＋本番用ビルド
- `npm run lint`：コードの書き方チェック（oxlint）
- データベースの変更は `supabase/schema.sql` を更新し、ユーザーに SQL Editor で実行してもらう
